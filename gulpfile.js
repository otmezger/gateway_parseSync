var gulp = require('gulp');
var rsync = require('gulp-rsync');
var watch = require('gulp-watch');



gulp.task('deploy', function() {
  gulp.src('./*')
    .pipe(rsync({
      root: './',
      username: 'teciot',
      hostname: '172.21.255.33',
      exclude:['./node_modules'],
      destination: '/home/teciot/productive/sync'
    }));
});


gulp.task('watch', function () {
        gulp.watch('./*.js', ['deploy']);
})
