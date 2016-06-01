var gulp = require('gulp');
var rsync = require('gulp-rsync');
var watch = require('gulp-watch');



gulp.task('deploy', function() {
  gulp.src('./*')
    .pipe(rsync({
      root: './',
      username: 'teciot',
      hostname: '172.18.129.223',
      exclude:['./node_modules'],
      destination: '/home/teciot/productive/sync'
    }));
});

gulp.task('deployOlmo', function() {
  gulp.src('./*')
    .pipe(rsync({
      root: './',
      username: 'energy',
      hostname: '192.168.1.116',
      exclude:['./node_modules'],
      destination: '/home/energy/productive/mongo2parsesync'
    }));
});
gulp.task('watch', function () {
        gulp.watch('./*.js', ['deploy']);
});
gulp.task('watchOlmo', function () {
        gulp.watch('./*.js', ['deployOlmo']);
});
