'use strict';

const BbPromise = require('bluebird');
const utils = require('../../shared/utils');
const fs = require('fs');
const path = require('path');

module.exports = {
  createFunctions () {
    const createFunctionPromises = [];

    this.serverless.service.getAllFunctions().forEach((functionName) => {
      const metaData = utils.getFunctionMetaData(functionName, this.provider.getParsedBindings(), this.serverless);

      createFunctionPromises.push(this.provider.createZipObjectAndUploadFunction(functionName, metaData.entryPoint, metaData.handlerPath, metaData.params));
    });

    createFunctionPromises.push(this.provider.createZipObjectAndUploadSource());

    const composerJsonFilePath = path.join(this.serverless.config.servicePath, 'composer.json');
    let createFunctionsPromise = BbPromise.all(createFunctionPromises)
                                .then(() => this.provider.syncTriggers())
                                .then(() => this.provider.runKuduCommand('del composer.json'))
                                .then(() => this.provider.runKuduCommand('del composer.lock'));

    if (fs.existsSync(composerJsonFilePath)) {
      return createFunctionsPromise.then(() => this.provider.uploadComposerJson())
        .then(() => this.provider.runKuduCommand('curl -sS https://getcomposer.org/installer | php'))
        .then(() => this.provider.runKuduCommand('php composer.phar install'));
    }
    else {
      return createFunctionsPromise.then(() => this.provider.runKuduCommand('rmdir /s /q vendor'));
    }
  }
};
