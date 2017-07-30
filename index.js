import path from 'path';
import child_process from 'child_process';
import webpack from 'webpack';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import express from 'express';
import webpackMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import clone from 'clone';

const app = express();
const middlewareMap = new Map();

function getProjectPath(name) {
  return path.resolve(__dirname, `./projects/${name}`);
}

function getWebpackConfig(name) {
  const projectPath = getProjectPath(name);
  const config = clone(require(`${projectPath}/webpack.config.js`));

  config.context = `${projectPath}`;
  // add correct entry path
  //config.entry.push(`${projectPath}/src/index.js`);
  config.entry.unshift('webpack-hot-middleware/client?path=__hmr');

  // fix public path
  config.output.publicPath = `/${name}/`;

  config.output.path = `/${name}`;
  config.plugins = config.plugins || [];
  config.plugins.push(
    new CopyWebpackPlugin([
      {
        from: 'index.html',
      },
    ]),
  );
  return config;
}

function getMiddlewareConfig(name) {
  return {
    // publicPath is required, whereas all other options are optional

    noInfo: false,
    // display no info to console (only warnings and errors)

    quiet: false,
    // display nothing to the console

    lazy: false,
    // switch into lazy mode
    // that means no watching, but recompilation on every request

    watchOptions: {
      aggregateTimeout: 300,
      poll: true,
    },
    // watch options (only lazy: false)

    //publicPath: `/${name}`,
    publicPath: `/`,
    // public path to bind the middleware to
    // use the same as in webpack

    index: 'index.html',
    // The index path for web server, defaults to "index.html".
    // If falsy (but not undefined), the server will not respond to requests to the root URL.

    headers: {
      'X-Custom-Header': 'yes',
    },
    // custom headers

    mimeTypes: {
      'text/html': ['phtml'],
    },
    // Add custom mime/extension mappings
    // https://github.com/broofa/node-mime#mimedefine
    // https://github.com/webpack/webpack-dev-middleware/pull/150

    stats: {
      colors: true,
    },
    // options for formating the statistics

    reporter: null,
    // Provide a custom reporter to change the way how logs are shown.

    serverSideRender: false,
    // Turn off the server-side rendering mode. See Server-Side Rendering part for more info.,,,,
  };
}

function wrap(middleware) {
  const wrapper = (req, res, next) => {
    if (middleware) {
      middleware(req, res, next);
    } else {
      next();
    }
  };
  wrapper.disable = () => {
    if (middleware.close) {
      middleware.close();
    }
    middleware = null;
  };

  return wrapper;
}

function getMiddlewares(name) {
  const compiler = webpack(getWebpackConfig(name));
  let devMiddleware = webpackMiddleware(compiler, getMiddlewareConfig(name));
  let hotMiddleware = webpackHotMiddleware(compiler, {
    log: console.log,
    path: '/__hmr',
  });

  return [wrap(devMiddleware), wrap(hotMiddleware)];
}

function addMiddleware(name) {
  const middlewares = getMiddlewares(name);
  middlewareMap.set(name, middlewares);
  app.use(`/${name}`, middlewares);
}

function removeMiddleware(name) {
  const middlewares = middlewareMap.get(name);
  if (middlewares) {
    middlewares.forEach(middleware => {
      middleware.disable();
      const index = app._router.stack.findIndex(
        layer => layer.handle === middleware,
      );
      if (index >= 0) {
        app._router.stack.splice(index, 1);
      }
    });
    middlewareMap.delete(name);
  }
}

function install(name) {
  console.log(`Installing dependensies for [${name}]`);
  child_process.execSync('npm install', { cwd: getProjectPath(name) });
}

install('pr1');
addMiddleware('pr1');

// Trying to to avoid something like 'superProject;rm -rf /'
function sanitize(name) {
  if (!name) {
    throw new Error('name must not be empty');
  }
  return name.split(';')[0].replace(/\s/g, '_');
}

app.get('/add/:name', (req, res) => {
  const name = sanitize(req.params.name);
  try {
    install(name);
    addMiddleware(name);
    res.send(`Build config [${name}] has been added`);
  } catch (ex) {
    console.log(ex);
    res.send(`Error adding config [${name}]`);
  }
});

app.get('/remove/:name', (req, res) => {
  const name = sanitize(req.params.name);
  try {
    removeMiddleware(name);
    res.send(`Build config [${name}] has been removed`);
  } catch (ex) {
    console.log(ex);
    res.send(`Error removing config [${name}]`);
  }
});

// Unfortunately, this implementation can only compile in serial
app.get('/wait/:secs', (req, res) => {
  const seconds = (req.params.secs || 10);

  const waitTill = new Date(new Date().getTime() + seconds * 1000);
  let last = new Date();
  let i = 0;
  while(waitTill > new Date()){
    if (new Date() - last >= 1000) {
      console.log(`Tick ${++i}`);
      last = new Date();
    }
  }
  console.log('Wait done!')
})
app.listen(8080);
console.log('http://localhost:8080/pr1/');
