import gulp from 'gulp';
import del from 'del';
import runSequence from 'run-sequence';
import babel from 'gulp-babel';

const forServer = () =>
  babel({
    presets: [['env', { targets: { node: 'current' } }]],
    babelrc: false
  });

const forNode = () =>
  babel({
    presets: [['env', { targets: { node: 'current' } }]],
    ignore: ['src/js/*.es', 'src/public'],
    babelrc: false
  });

const forBrowsers = () =>
  babel({
    presets: [
      ['env', { targets: { browsers: ['last 2 versions', 'safari >= 8'] } }]
    ],
    only: ['src/public/**/*.es'],
    babelrc: false
  });

gulp.task('babelServer', () =>
  gulp
    .src('server.es')
    .pipe(forServer())
    .pipe(gulp.dest('./'))
);

gulp.task('babelNodeFiles', () =>
  gulp
    .src('src/**/*.es')
    .pipe(forNode())
    .pipe(gulp.dest('app'))
);

gulp.task('babelJSFiles', () =>
  gulp
    .src('src/public/**/*.es')
    .pipe(forBrowsers())
    .pipe(gulp.dest('app/public'))
);

gulp.task('clean', () => {
  del('app/**/*.es', { force: true });
});

gulp.task(
  'default',
  runSequence(['babelServer', 'babelNodeFiles', 'babelJSFiles'], 'clean')
);
