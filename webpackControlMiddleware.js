export default function webpackControlMiddleware (compiler, opts) {

  compiler.plugin('done', stats => {
    console.log('Compilation done: ', stats.hash, stats.time);
  });

  compiler.plugin('compilation', (c, params) => {
  });

  return function (req, res, next) {
    return next();
  };

};
