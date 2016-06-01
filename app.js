var _ = require('underscore');
var mongoose = require('mongoose'); // from http://mongoosejs.com/docs/index.html
var Parse = require('parse/node').Parse;
var moment = require('moment');
var config = require('./config');


var NBatchSaveAll = 10;
var limitMongo = 500;

var db = mongoose.connect('mongodb://localhost/sensors');
//var db = mongoose.connect('mongodb://db.local/sensors');


var dataPointSchema = new mongoose.Schema({
    value: {
        type: Number
    },
    timestamp: {type: Date},
    sensorID: {type: String},
    parseSync: {type: Boolean, default:false},
    versionKey: false // You should be aware of the outcome after set to false
});

//var DataPoint = mongoose.model('DataPoint', dataPointSchema);



Parse.initialize(config.appKey, config.jsKey,config.masterKey);
Parse.serverURL = config.serverURL;
Parse.Cloud.useMasterKey();


// ---------------------------------------------------------------------------------- DataPoint
// --------------------------------------------------- MODEL
var DataPointModel = Parse.Object.extend({
  className: "DataPoint"
});
// --------------------------------------------------- QUERY
var DataPointQuery = new Parse.Query(DataPointModel);
//DataPointQuery.find();

// ---------------------------------------------------------------------------------- Sensor
// --------------------------------------------------- MODEL
var SensorModel = Parse.Object.extend({
  className: "Sensors"
});
// --------------------------------------------------- QUERY
var SensorQuery = new Parse.Query(SensorModel);
//SensorQuery.find();

// ###################################################################################### Calculation!
var minutes = 0.5, the_interval = minutes * 60 * 1000;
var syncCheck = null;
var savingDone = true; //lo actualizo cuando entro a doSave y al salir del mismo
setInterval(function() {
  //console.log('going to start the Sync');
  if(savingDone)
  doProcess();
  //console.log('sync finished');
  // do your stuff here
}, the_interval);

var doProcess = function() {
  if (syncCheck) { return syncCheck; }

  //var dfd = $.Deferred();
  var dfd = new Parse.Promise();
  syncCheck = dfd;

  var success = function(resp) {
    dfd.resolve();
    syncCheck = null;
  };

  var fail = function() {
    dfd.reject();
    syncCheck = null;
  };

  var check = function() {
    var req = doSync();
    req.then( success, fail );
  };

  setTimeout(check, 100); // Pero creo que mi nueva solucion puede morir a causa de esto...

  return dfd;
};

var doSync = function(){
  savingDone = false;  //Bloqueo mas llamados
  var startDate = moment();
  var endDate;
  var nMongo;
  console.log('going to do find')
  var DataPoint = mongoose.model('DataPoint', dataPointSchema);
  return DataPoint.find({'parseSync':false})
    .select({})
    .sort({'timestamp':1})
    .limit(limitMongo)
    .exec(function(err, dataPoints){
      if (err) return handleError(err);
      // now we got a query from MongoDB. we can iterate over it
      nMongo = dataPoints.length;
      console.log('got ' + nMongo + ' datapoints.');
      if (nMongo == limitMongo){console.log('ATTENTION: there might be more items. Limiting at ' + limitMongo);}
      console.log('--- called saveDataPoints!');
      var processPromise = Parse.Promise.as();
      processPromise.then(function(){
        var dataObjectParseArray = [];
        var dataObjectMongoArray = [];


        var promise = Parse.Promise.as();// INTERNATL Promise
        _.each(dataPoints,function(thisDataPoint,iDataPoint){
          promise = promise.then(function(){
            var lastDataPoint = false;
            dataObjectParseArray.push(generateParseDataPoint(thisDataPoint));
            dataObjectMongoArray.push(thisDataPoint);
            if (iDataPoint +1 == dataPoints.length){
              // this is the last element!
              lastDataPoint = true;
            }

            if (lastDataPoint){
              var NBatchSaveAllThisRun = dataObjectParseArray.length;
            }else{
              var NBatchSaveAllThisRun = NBatchSaveAll;
            }
            if ((iDataPoint + 1)%NBatchSaveAllThisRun == 0){
              // we just completed the specified size of the deleteArrayPromises
              var dataObjectParseArray_ = dataObjectParseArray.slice(0);
              // http://davidwalsh.name/javascript-clone-array
              dataObjectParseArray = [];
              //remainingDrives = remainingDrives - saveArray_.length;
              console.log('--- --- attempting to save ' + dataObjectParseArray_.length + ' datapoints.');
              var internalPromise = Parse.Promise.as();
              internalPromise.then(function(){
                console.log('--- --- --- saving to parse!');
                return Parse.Object.saveAll(dataObjectParseArray_).then(function(){
                  console.log('--- --- ---> Saving to parse OK');
                },function(e){
                  console.log('--- --- ---> Saving to parse KO with error:');
                  console.log(e);
                });

              }).then(function(){
                // here we need to save this objects in mongo
                console.log('--- --- --- updating mongo');
                if (dataObjectMongoArray.length > 0){
                  var mongooseSaveIDs = [];
                  _.each(dataObjectMongoArray,function(thisDataPointInternal){
                    mongooseSaveIDs.push(thisDataPointInternal._id);
                  });
                  dataObjectMongoArray = [];

                  console.log('--- --- attempting to update N mongoDB documents: ' + mongooseSaveIDs.length + '. ');
                  return DataPoint.update({
                      '_id':{
                        '$in':mongooseSaveIDs
                      }
                    },{
                      '$set':{
                        'parseSync':true
                      }
                    },{
                      'multi':true
                    }).exec();
                }else{
                  return Parse.Promise.as();
                }


                //
                //return Parse.Promise.when(mongooseSavePromisesArray);
              },function(errror){
                console.log('error');
                console.log(error);
              }); //internalPromise tail
              //console.log('going to return internalPromise');
              return internalPromise;
            }else{
              // this is not the NBatchSaveAll'th array, do not attempt to save, but continue.
              return Parse.Promise.as();
            }
          }); // promise tail.
        }); // end each dataPoints.
        return promise;
      }).then(function(){
        console.log('--- ending saveDataPoints!');
        //closeMongoDBConnection();
        endDate = moment();
        console.log('operation completed ' + endDate.from(startDate));
        savingDone = true; //Desbloqueo mas llamados
      }); // tail processPromise

    }); // end of exec for mongoose query.
} // end of doSync



var closeMongoDBConnection = function(){
  console.log('--- called closeMongoDBConnection!');
  mongoose.connection.close();
  console.log('--- MongoDBConnection closed');
}


function parseDate(date){
  // check the date input and output a parse.com friendly date.
  //console.log(typeof(date));

  if (typeof(date)=='number'){
    // mostly it is ms.
    if (date> 1325397600000 ) { // validation check. check if date in ms is > than 01-01-2012
      var newDate = new Date(date);
      return newDate;
    } else {
      console.log(' Error in parseDate. Date is number, but smaller than given date');
    }
    //  } else if () {
    //    console.log('date type not supported yet')
  } else if (date instanceof Date) {
    // date is an object Date.
    return new Date(date);// actually not needed, it is already a Date object... just to see if it works better this way.

  }else {
    console.log('date type not supported yet')
  } // end of if typeof(date)
}


function generateParseDataPoint(thisDataPoint){
  var thisSensorParse = new SensorModel();
  thisSensorParse.set('id',thisDataPoint.sensorID);

  thisDataPointParse = new DataPointModel();

  thisDataPointParse.set('value',thisDataPoint.value);
  thisDataPointParse.set('timeStamp',parseDate(thisDataPoint.timestamp));
  thisDataPointParse.set('Sensor',thisSensorParse);
  return thisDataPointParse;
}
