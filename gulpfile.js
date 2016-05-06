var gulp = require('gulp');
var rsync = require('gulp-rsync');
var watch = require('gulp-watch');



gulp.task('deploy', function() {
  gulp.src('./*')
    .pipe(rsync({
      root: './',
      username: 'energy',
      hostname: '186.176.109.126',
      exclude:['./node_modules'],
      destination: '/home/energy/productive/mongo2parsesync'
    }));
});


gulp.task('watch', function () {
        gulp.watch('./*.js', ['deploy']);
})
