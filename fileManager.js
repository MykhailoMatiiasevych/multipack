import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import zlib from 'zlib';
import tar from 'tar-fs';
import tarStream from 'tar-stream';

export function ensureFilePath (filePath) {
  return new Promise((resolve, reject) => {
    fs.ensureFile(filePath, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function ensureDirPath (dirPath) {
  return new Promise((resolve, reject) => {
    fs.ensureDir(dirPath, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function readFile (filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, {encoding: 'utf8'}, (err, data) => {
      if (err) {
        reject('Can\'t read file: ' + filePath + '. Cause: ' + err.message);
      } else {
        resolve(data);
      }
    });
  });
}

export function writeFile (filePath, fileData) {
  return new Promise((resolve, reject) => {
    if (!fileData) {
      reject('File data is undefined. File path: ' + filePath);
    }
    fs.writeFile(filePath, fileData, {encoding: 'utf8'}, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function writeBinaryFile (filePath, fileData) {
  return new Promise((resolve, reject) => {
    if (!fileData) {
      reject('File data is undefined. File path: ' + filePath);
    }
    fs.writeFile(filePath, fileData, {encoding: null}, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function placeInPosition (filePath, options) {
  return readFile(filePath)
    .then(data => {
      if (!data) {
        throw Error('Cannot place content into file. Cause: file is empty. File path: ' + filePath);
      }
      let dataArray = data.split('');
      let inDataArray = options.text.split('');
      let args = [options.position, 0];
      args = args.concat(inDataArray);
      Array.prototype.splice.apply(dataArray, args);
      return dataArray.join('');

    })
    .then(fileData => {
      return writeFile(filePath, fileData, options.format);
    });
}

export function copyFiles (options) {
  return options.reduce(
    (sequence, valuePair) => {
      return sequence.then(() => {
        return copyFile(valuePair.srcFilePath, valuePair.destFilePath);
      });
    },
    Promise.resolve()
  );
}

export function copyFilesNoError (options) {
  return options.reduce(
    (sequence, valuePair) => {
      return sequence.then(() => {
        return copyFile(valuePair.srcFilePath, valuePair.destFilePath)
          .catch(error => {
            console.error(error);
          });
      });
    },
    Promise.resolve()
  );
}

export function copyFile (srcFilePath, destFilePath) {
  return new Promise((resolve, reject) => {
    fs.stat(srcFilePath, (err, stat) => {
      if (err) {
        reject(err);
      } else if (stat) {
        if (stat.isDirectory()) {
          fs.ensureDir(destFilePath, err => {
            if (err) {
              reject(err);
            } else {
              fs.copy(srcFilePath, destFilePath, function (err) {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            }
          });
        } else if (stat.isFile()) {
          fs.ensureFile(destFilePath, err => {
            if (err) {
              reject(err);
            } else {
              fs.copy(srcFilePath, destFilePath, function (err) {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            }
          });
        }
      }
    });
  });
}

export function traverseDirTree (tree, callback) {
  if (tree) {
    if (tree.dirs && tree.dirs.length > 0) {
      tree.dirs.forEach(dir => {
        callback('dir', dir);
        traverseDirTree(dir, callback);
      });
    }
    if (tree.files && tree.files.length > 0) {
      tree.files.forEach(file => {
        callback('file', file);
      });
    }
  }
}

export function isExisting (filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stat) => {
      if (err) {
        reject(err);
      } else {
        if (stat.isDirectory() || stat.isFile()) {
          resolve();
        } else {
          reject(filePath + ' is not a file or a dir');
        }
      }
    });
  });
}

export function findComponentFilePath (filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stat) => {
      if (err) {
        reject(err);
      } else {
        if (stat.isDirectory()) {
          let testFilePath = path.join(filePath, 'index.js');
          fs.stat(testFilePath, (err, stat) => {
            if (err) {
              reject(err);
            } else {
              if (stat.isFile()) {
                resolve(testFilePath);
              } else {
                reject(filePath + ' is not a file or a dir');
              }
            }
          });
          // Slower then direct reading :-(
          // resolve(findComponentFilePath(path.join(filePath, 'index.js')));
        } else if (stat.isFile()) {
          if (!filePath.endsWith('.js') || !filePath.endsWith('.jsx')) {
            resolve(filePath + '.js');
          } else {
            resolve(filePath);
          }
        } else {
          reject(filePath + ' is not a file or a dir');
        }
      }
    });
  });
}

export function readDirectoryTree (result, start, callback, testFileNames = undefined) {

  // Use lstat to resolve symlink if we are passed a symlink
  fs.lstat(start, (err, stat) => {
      if (err) {
        callback(err);
      }
      let total = 0;
      let processed = 0;
      var isDir = (dirPath, fileName) => {
        const abspath = path.join(dirPath, fileName).replace(/\\/g, '/');
        fs.stat(abspath, (err, stat) => {
          if (err) {
            callback(err);
          }
          if (stat && stat.isDirectory()) {
            var dirNamePath = result.dirNamePath ? result.dirNamePath + '.' + fileName : fileName;
            var resultDir = {dirName: fileName, dirNamePath: dirNamePath, dirPath: abspath, dirs: [], files: []};
            result.dirs.push(resultDir);
            readDirectoryTree(resultDir, abspath, err => {
              if (err) {
                callback(err);
              }
              if (++processed == total) {
                callback();
              }
            }, testFileNames);
          } else {
            let isValid = testFileNames ? _.includes(testFileNames, fileName) : true;
            if (isValid) {
              result.files.push({
                fileName: fileName,
                filePath: abspath
              });
            }
            if (++processed == total) {
              callback();
            }
          }
        });
      };
      if (stat && stat.isDirectory()) {
        fs.readdir(start, (err, files) => {
          if (err) {
            callback(err);
          }
          total = files.length;
          if (total === 0) {
            callback();
          }
          files.sort((a, b) => {
            if (a > b) {
              return 1;
            }
            if (a < b) {
              return -1;
            }
            return 0;
          });
          for (let x = 0, l = files.length; x < l; x++) {
            isDir(start, files[x]);
          }
        });
      } else {
        callback('Path: ' + start + ' is not a directory');
      }
    }
  );
}

export function readDirectory (dirPath, testFileNames = undefined) {
  return new Promise((resolve, reject) => {
    let result = {dirs: [], files: []};
    readDirectoryTree(result, dirPath, err => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    }, testFileNames);
  });
}

export function readDirectoryFiles (dirPath, testFileNames = undefined) {
  return readDirectory(dirPath, testFileNames).then(dirTree => {
    let files = [];
    traverseDirTree(dirTree, (type, obj) => {
      if (type === 'file') {
        files.push(obj.filePath);
      }
    });
    return {files};
  });
}

export function readDirectoryFlat (dirPath) {
  return new Promise((resolve, reject) => {
    fs.lstat(dirPath, (err, stat) => {
      if (err) {
        reject(err);
      }
      let found = {files: [], dirs: []},
        total = 0;

      // Read through all the files in this directory
      if (stat && stat.isDirectory()) {
        fs.readdir(dirPath, (err, files) => {
          total = files.length;
          if (total === 0) {
            resolve(found);
          }
          let tasks = [];
          for (let x = 0, l = files.length; x < l; x++) {
            let absPath = path.join(dirPath, files[x]).replace(/\\/g, '/');
            let fileName = files[x];
            tasks.push(
              new Promise((processed, failed) => {
                fs.stat(absPath, (err, stat) => {
                  if (err) {
                    failed(err);
                  }
                  if (stat.isDirectory()) {
                    found.dirs.push({
                      name: fileName,
                      path: absPath
                    });
                  } else {
                    found.files.push({
                      name: fileName,
                      path: absPath
                    });
                  }
                  processed(found);
                });
              })
            );
          }
          return Promise.all(tasks).then(() => {
            resolve(found);
          });
        });
      } else {
        reject('path: ' + dirPath + ' is not a directory');
      }

    });
  });
}

export function checkDirIsEmpty (dirPath) {
  return new Promise((resolve, reject) => {
    fs.stat(dirPath, (err, stat) => {
      if (err) {
        reject('Can not read directory. ' + err);
      } else {
        if (stat && stat.isDirectory()) {
          fs.readdir(dirPath, (err, files) => {
            let total = files.length;
            if (total === 0) {
              resolve();
            } else {
              reject(dirPath + ' is not empty');
            }
          });
        } else {
          reject(dirPath + ' is not a directory');
        }
      }
    });
  });
}

export function readJson (filePath) {
  return new Promise((resolve, reject) => {
    fs.readJson(filePath, (err, packageObj) => {
      if (err) {
        reject(err);
      } else {
        resolve(packageObj);
      }
    });
  });
}

export function writeJson (filePath, jsonObj) {
  return ensureFilePath(filePath)
    .then(() => {
      return new Promise((resolve, reject) => {
        fs.writeJson(filePath, jsonObj, err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
}

export function removeFile (filePath) {
  return new Promise((resolve, reject) => {
    fs.remove(filePath, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function unpackTarGz (srcFilePath, destDirPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(srcFilePath)
      .pipe(zlib.createGunzip())
      .on('error', err => { reject(err); })
      .pipe(tar.extract(destDirPath, {dmode: '0666', fmode: '0666'})
        .on('finish', () => { resolve(); }))
      .on('error', err => { reject(err); });
  });
}

export function unpackTar (srcFilePath, destDirPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(srcFilePath)
      .pipe(tar.extract(destDirPath, {dmode: '0666', fmode: '0666'})
        .on('finish', () => { resolve(); }))
      .on('error', err => { reject(err); });
  });
}

export function repackTarGzOmitRootDir (srcFilePath) {
  return new Promise((resolve, reject) => {
    let destFilePathTemp = srcFilePath + '_tmp';

    let pack = tarStream.pack();
    let extract = tarStream.extract();

    extract.on('entry', function (header, stream, callback) {
      header.name = header.name.substr(header.name.indexOf('/') + 1);
      if (header.name.length > 0) {
        stream.pipe(pack.entry(header, callback));
      } else {
        stream.resume();
        return callback();
      }
    });

    extract.on('finish', () => {
      pack.finalize();
      resolve(destFilePathTemp);
    });

    extract.on('error', err => {
      reject(err);
    });

    fs.createReadStream(srcFilePath)
      .pipe(zlib.createGunzip())
      .pipe(extract);

    let destFile = fs.createWriteStream(destFilePathTemp);
    pack.pipe(destFile);

  });
}

export function packTarGz (srcDirPath, destFilePath, entries) {
  return new Promise((resolve, reject) => {
    let destFile = fs.createWriteStream(destFilePath);
    tar.pack(srcDirPath, {entries: entries}).pipe(zlib.createGzip()).pipe(destFile)
      .on('finish', () => { resolve(); })
      .on('error', err => { reject(err); });
  });
}
