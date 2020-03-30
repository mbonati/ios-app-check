#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const execSync = require('child_process').execSync;
const _ = require('lodash');
const Table = require('tty-table')
const arg = require('arg');
const pkg = require('../package.json');

const args = arg({
    // Types
    '--file': String,
    '--help': Boolean,
    '--version': Boolean,
    '--verbose': arg.COUNT,   // Counts the number of times --verbose is passed

    // Aliases
    '-v': '--verbose',
    '-f': '--file',
});

const tableHeader = [
    {
        value: "Framework/Dynamic Library",
        formatter: function (value) {
            return this.style(value, "cyan")
        },
        align: 'left',
        width: 30
    },
    {
        value: "i386",
        width: 10
    },
    {
        value: "x86_64",
        width: 10
    },
    {
        value: "armv7",
        width: 10
    },
    {
        value: "armv7s",
        width: 10
    },
    {
        value: "arm64",
        width: 10
    },
    {
        value: "arm64e",
        width: 10
    },
]

const archList = ['i386', 'x86_64', 'armv7', 'armv7s', 'arm64', 'arm64e'];

export function cli() {

    const filePath = args['--file'];
    const verbose = args['--verbose'];

    if (args['--help']) {
        console.log('' + pkg.name + ' version ' + pkg.version);
        return;
    }

    if (args['--version']) {
        console.log('' + pkg.name + ' version ' + pkg.version);
        return;
    }

    if (!filePath) {
        console.log('The file parameter (--file) is required.');
        return;
    }

    checkApp(filePath, verbose, res => {

    });

}

// checkApp(currentAppPath, res=>{

// });

function checkApp(appPath, verbose, callback) {

    const appArchs = getAppArchitectures(appPath, verbose);
    if (checkForWrongArchs(appArchs)) {
        console.log('The application contains wrong architectures for App Store: ', appArchs);
        return;
    } else {
        console.log('Your application supports these architecures:', appArchs);
    }

    getFrameworksArchitectures(appPath, verbose, (error, results, wrongArchsLibs) => {
        if (error) {
            console.error(error);
        } else {
            console.log('');
            console.log('All frameworks architectures found report:');
            console.log(renderArchsTable(results));
            console.log('');
            if (wrongArchsLibs.length > 0) {
                console.log('There are some wrong architectures in your application:');
                console.log(wrongArchsLibs);
                console.log('');
            } else {
                console.log('');
                console.info('Your application is ready for the App Store submission.');
                console.log('');
            }
        }
    });
}

function renderArchsTable(data) {
    const t3 = Table(tableHeader, [], {});
    for (var i = 0; i < data.length; i++) {
        addTableRow(data[i], t3);
    }
    return t3.render()
    return '';
}

function addTableRow(dataRow, table) {

    let row = [dataRow.framework];
    for (let i = 0; i < archList.length; i++) {
        const n = _.find(dataRow.archs, el => {
            return (el === archList[i]);
        });
        if (n) {
            row.push('*');
        } else {
            row.push('');
        }
    }

    table.push(row);
}

function getAppArchitectures(appPath, verbose) {

    const baseAppName = path.basename(appPath, '.app');
    const appBinPath = path.join(appPath, baseAppName);
    return getBinaryArchitectures(appBinPath, verbose);
}

function getFrameworksArchitectures(appPath, verbose, callback) {

    const libResults = [];
    const wrongArchsLibs = [];

    //console.log('Getting frameworks contained into ', appPath);

    const frameworksPath = path.join(appPath, 'Frameworks')

    getFolderFiles(frameworksPath, (error, data) => {
        if (error) {
            console.error('Error:', error);
            callback(error, null);
        } else {
            //console.log('Frameworks Found in ', appPath, data);
            for (let i = 0; i < data.length; i++) {
                const frameworkPath = getFrameworkPath(appPath, data[i]);
                if (frameworkPath) {
                    //console.log('Checking for ', frameworkPath);
                    const results = getBinaryArchitectures(frameworkPath, verbose);
                    if (results) {
                        const item = { framework: data[i], archs: results };
                        libResults.push(item);
                        if (checkForWrongArchs(results)) {
                            wrongArchsLibs.push(item);
                        }
                    }
                    const symbols = [ 'UIImagePickerController', 'PHPhotoLibrary', 'PHAsset', 'PHAssetCollection', 'PHCollection', 'PHCollectionList'];
                    findUsedSymbols(frameworkPath, symbols, verbose);
                }
            }
            callback(null, libResults, wrongArchsLibs);
        }
    });

}

function findUsedSymbols(frameworkPath, symbols, verbose) {

    const frameworkName = path.basename(frameworkPath);
    //console.log('findUsedSymbols for framework=' + frameworkName);
    try {
        const execCmd = 'nm ' + frameworkPath;
        let results = execSync(execCmd).toString();
        const resultData = { framework: frameworkName, symbols: [] };
        for (let i = 0; i < symbols.length; i++) {
            const find = results.search(symbols[i]);
            if (find >= 0) {
                resultData.symbols.push(symbols[i]);
            }
        }
        if (resultData.symbols.length > 0) {
            console.log('');
            console.log('>>>>>> Find Symbols', resultData);
            console.log('');
            return resultData;
        } else {
            return null;
        }
    } catch (ex) {
        //console.log('Error:', ex);
        return null;
    }

}


function checkForWrongArchs(data) {
    const n = _.find(data, el => {
        return (el === 'i386' || el === 'x86_64');
    });
    return (n != null);
}

function getFrameworkPath(appPath, frameworkName) {
    if (isFramework(frameworkName)) {
        const frameworkBaseName = path.basename(frameworkName, '.framework');
        return path.join(appPath, 'Frameworks', frameworkName, frameworkBaseName);
    } else if (isDynamicLibrary(frameworkName)) {
        return path.join(appPath, 'Frameworks', frameworkName);
    } else {
        return null;
    }
}

function isFramework(frameworkName) {
    const extName = path.extname(frameworkName);
    return extName === '.framework';
}

function isDynamicLibrary(frameworkName) {
    const extName = path.extname(frameworkName);
    return extName === '.dylib';
}

function getFolderFiles(path, callback) {
    fs.readdir(path, (err, files) => {
        //handling error
        if (err) {
            callback(err, null);
        }
        //listing all files using forEach
        const ret = [];
        files.forEach(function (file) {
            // Do whatever you want to do with the file
            //console.log(file);
            ret.push(file);
        });
        callback(null, ret);
    });
}

function getBinaryArchitectures(frameworkPath, verbose) {

    const symbols = ['UIImagePickerController', 'PHPhotoLibrary', 'PHAsset', 'PHAssetCollection', 'PHCollection', 'PHCollectionList'];
    findUsedSymbols(frameworkPath, symbols, verbose);

    let results = execSync('lipo -info ' + frameworkPath).toString();

    if (verbose) {
        console.log('Binary ' + path.basename(frameworkPath) + ': ', results);
    }

    const n = results.search('are: ');
    const n2 = results.search('is architecture: ');
    if (n > 0) {
        const ret = results.slice(n, results.length).replace('\n', '').replace('are: ', '').trim().split(' ');
        return ret;
    } else if (n2 > 0) {
        const ret = results.slice(n2, results.length).replace('\n', '').replace('is architecture: ', '').trim().split(' ');
        return ret;
    } else {
        return null;
    }

}

// function execute(command, callback){
//     //exec(command, function(error, stdout, stderr){ callback(stdout); });
// };



