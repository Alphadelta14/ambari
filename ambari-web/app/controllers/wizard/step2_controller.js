/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var App = require('app');
var validator = require('utils/validator');
var lazyloading = require('utils/lazy_loading');

App.WizardStep2Controller = Em.Controller.extend({

  name: 'wizardStep2Controller',

  /**
   * List of not installed hostnames
   * @type {string[]}
   */
  hostNameArr: [],

  /**
   * Does pattern-expression for hostnames contains some errors
   * @type {bool}
   */
  isPattern: false,

  /**
   * Don't know if it used any more
   */
  bootRequestId: null,

  /**
   * Is step submitted
   * @type {bool}
   */
  hasSubmitted: false,

  /**
   * @type {string[]}
   */
  inputtedAgainHostNames: [],

  /**
   * Is Installer Controller used
   * @type {bool}
   */
  isInstaller: function () {
    return this.get('content.controllerName') == 'installerController';
  }.property('content.controllerName'),

  /**
   * "Shortcut" to <code>content.installOptions.hostNames</code>
   * @type {string[]}
   */
  hostNames: function () {
    return this.get('content.installOptions.hostNames');
  }.property('content.installOptions.hostNames'),

  /**
   * Is manual install selected
   * "Shortcut" to <code>content.installOptions.manualInstall</code>
   * @type {bool}
   */
  manualInstall: function () {
    return this.get('content.installOptions.manualInstall');
  }.property('content.installOptions.manualInstall'),

  /**
   * "Shortcut" to <code>content.installOptions.sshKey</code>
   * @type {string}
   */
  sshKey: function () {
    return this.get('content.installOptions.sshKey');
  }.property('content.installOptions.sshKey'),

  /**
   * "Shortcut" to <code>content.installOptions.sshUser</code>
   * @type {string}
   */
  sshUser: function () {
    return this.get('content.installOptions.sshUser');
  }.property('content.installOptions.sshUser'),

  /**
   * Installed type based on <code>manualInstall</code>
   * @type {string}
   */
  installType: function () {
    return this.get('manualInstall') ? 'manualDriven' : 'ambariDriven';
  }.property('manualInstall'),

  /**
   * List of invalid hostnames
   * @type {string[]}
   */
  invalidHostNames: [],

  /**
   * Error-message if <code>hostNames</code> is empty, null otherwise
   * @type {string|null}
   */
  hostsError: null,

  /**
   * Error-message if <code>sshKey</code> is empty, null otherwise
   * @type {string|null}
   */
  sshKeyError: function () {
    if (this.get('hasSubmitted') && this.get('manualInstall') === false && Em.isEmpty(this.get('sshKey').trim())) {
      return Em.I18n.t('installer.step2.sshKey.error.required');
    }
    return null;
  }.property('sshKey', 'manualInstall', 'hasSubmitted'),

  /**
   * Error-message if <code>sshUser</code> is empty, null otherwise
   * @type {string|null}
   */
  sshUserError: function () {
    if (this.get('manualInstall') === false && Em.isEmpty(this.get('sshUser').trim())) {
      return Em.I18n.t('installer.step2.sshUser.required');
    }
    return null;
  }.property('sshUser', 'hasSubmitted', 'manualInstall'),

  /**
   * is Submit button disabled
   * @type {bool}
   */
  isSubmitDisabled: function () {
    return (this.get('hostsError') || this.get('sshKeyError') || this.get('sshUserError'));
  }.property('hostsError', 'sshKeyError', 'sshUserError'),

  /**
   * Set not installed hosts to the hostNameArr
   * @method updateHostNameArr
   */
  updateHostNameArr: function () {
    this.set('hostNameArr', this.get('hostNames').trim().split(new RegExp("\\s+", "g")));
    this.parseHostNamesAsPatternExpression();
    this.get('inputtedAgainHostNames').clear();
    var installedHostNames = App.Host.find().mapProperty('hostName'),
      tempArr = [],
      hostNameArr = this.get('hostNameArr');
    for (var i = 0; i < hostNameArr.length; i++) {
      if (!installedHostNames.contains(hostNameArr[i])) {
        tempArr.push(hostNameArr[i]);
      }
      else {
        this.get('inputtedAgainHostNames').push(hostNameArr[i]);
      }
    }
    this.set('hostNameArr', tempArr);
  },

  /**
   * Validate host names
   * @method isAllHostNamesValid
   * @return {bool}
   */
  isAllHostNamesValid: function () {
    var result = true;
    this.updateHostNameArr();
    this.get('invalidHostNames').clear();
    this.get('hostNameArr').forEach(function (hostName) {
      if (!validator.isHostname(hostName)) {
        this.get('invalidHostNames').push(hostName);
        result = false;
      }
    }, this);

    return result;
  },

  /**
   * Set hostsError if host names don't pass validation
   * @method checkHostError
   */
  checkHostError: function () {
    if (Em.isEmpty(this.get('hostNames').trim())) {
      this.set('hostsError', Em.I18n.t('installer.step2.hostName.error.required'));
    }
    else {
      this.set('hostsError', null);
    }
  },

  /**
   * Check hostnames after Submit was clicked or <code>hostNames</code> were changed
   * @method checkHostAfterSubmitHandler
   */
  checkHostAfterSubmitHandler: function () {
    if (this.get('hasSubmitted')) {
      this.checkHostError();
    }
  }.observes('hasSubmitted', 'hostNames'),

  /**
   * Get host info, which will be saved in parent controller
   * @method getHostInfo
   */
  getHostInfo: function () {

    var hostNameArr = this.get('hostNameArr');
    var hostInfo = {};
    for (var i = 0; i < hostNameArr.length; i++) {
      hostInfo[hostNameArr[i]] = {
        name: hostNameArr[i],
        installType: this.get('installType'),
        bootStatus: 'PENDING'
      };
    }

    return hostInfo;
  },

  /**
   * Used to set sshKey from FileUploader
   * @method setSshKey
   * @param {string} sshKey
   */
  setSshKey: function (sshKey) {
    this.set("content.installOptions.sshKey", sshKey);
  },

  /**
   * Onclick handler for <code>next button</code>. Do all UI work except data saving.
   * This work is doing by router.
   * @method evaluateStep
   * @return {bool}
   */
  evaluateStep: function () {
    console.log('TRACE: Entering controller:WizardStep2:evaluateStep function');

    if (this.get('isSubmitDisabled')) {
      return false;
    }

    this.set('hasSubmitted', true);

    this.checkHostError();
    if (this.get('hostsError') || this.get('sshUserError') || this.get('sshKeyError')) {
      return false;
    }

    this.updateHostNameArr();

    if (!this.get('hostNameArr.length')) {
      this.set('hostsError', Em.I18n.t('installer.step2.hostName.error.already_installed'));
      return false;
    }

    if (this.get('isPattern')) {
      this.hostNamePatternPopup(this.get('hostNameArr'));
      return false;
    }
    if (this.get('inputtedAgainHostNames.length')) {
      this.installedHostsPopup();
    }
    else {
      this.proceedNext();
    }
    return true;
  },

  /**
   * check is there a pattern expression in host name textarea
   * push hosts that match pattern in hostNamesArr
   * @method parseHostNamesAsPatternExpression
   */
  parseHostNamesAsPatternExpression: function () {
    this.set('isPattern', false);
    var self = this;
    var hostNames = [];
    $.each(this.get('hostNameArr'), function (e, a) {
      var start, end, extra = {0: ""};
      if (/\[\d*\-\d*\]/.test(a)) {
        start = a.match(/\[\d*/);
        end = a.match(/\-\d*]/);

        start = start[0].substr(1);
        end = end[0].substr(1);

        if (parseInt(start) <= parseInt(end, 10) && parseInt(start, 10) >= 0) {
          self.set('isPattern', true);

          if (start[0] == "0" && start.length > 1) {
            extra = start.match(/0*/);
          }

          for (var i = parseInt(start, 10); i < parseInt(end, 10) + 1; i++) {
            hostNames.push(a.replace(/\[\d*\-\d*\]/, extra[0].substring(0, start.length - i.toString().length) + i))
          }

        } else {
          hostNames.push(a);
        }
      } else {
        hostNames.push(a);
      }
    });
    this.set('hostNameArr', hostNames);
  },

  /**
   * launch hosts to bootstrap
   * and save already registered hosts
   * @method proceedNext
   * @return {bool}
   */
  proceedNext: function (warningConfirmed) {
    if (this.isAllHostNamesValid() !== true && !warningConfirmed) {
      this.warningPopup();
      return false;
    }

    if (this.get('manualInstall') === true) {
      this.manualInstallPopup();
      return false;
    }

    var bootStrapData = JSON.stringify({'verbose': true, 'sshKey': this.get('sshKey'), 'hosts': this.get('hostNameArr'), 'user': this.get('sshUser')});

    if (App.get('skipBootstrap')) {
      this.saveHosts();
      return true;
    }

    var requestId = App.router.get(this.get('content.controllerName')).launchBootstrap(bootStrapData);
    if (requestId == '0') {
      var controller = App.router.get(App.clusterStatus.wizardControllerName);
      controller.registerErrPopup(Em.I18n.t('common.information'), Em.I18n.t('installer.step2.evaluateStep.hostRegInProgress'));
    } else if (requestId) {
      this.set('content.installOptions.bootRequestId', requestId);
      this.saveHosts();
    }
    return true;
  },

  /**
   * show warning for host names without dots or IP addresses
   * @method warningPopup
   */
  warningPopup: function () {
    var self = this;
    App.ModalPopup.show({
      header: Em.I18n.t('common.warning'),
      onPrimary: function () {
        this.hide();
        self.proceedNext(true);
      },
      bodyClass: Em.View.extend({
        template: Em.Handlebars.compile(Em.I18n.t('installer.step2.warning.popup.body').format(self.get('invalidHostNames').join(', ')))
      })
    });
  },

  /**
   * show popup with the list of hosts that are already part of the cluster
   * @method installedHostsPopup
   */
  installedHostsPopup: function () {
    var self = this;
    App.ModalPopup.show({
      header: Em.I18n.t('common.warning'),
      onPrimary: function () {
        self.proceedNext();
        this.hide();
      },
      bodyClass: Em.View.extend({
        inputtedAgainHostNames: function () {
          return self.get('inputtedAgainHostNames').join(', ');
        }.property(),
        templateName: require('templates/wizard/step2_installed_hosts_popup')
      })
    });
  },

  /**
   * Show popup with hosts generated by pattern
   * @method hostNamePatternPopup
   * @param {string[]} hostNames
   */
  hostNamePatternPopup: function (hostNames) {
    var self = this;
    App.ModalPopup.show({
      header: Em.I18n.t('installer.step2.hostName.pattern.header'),
      onPrimary: function () {
        self.proceedNext();
        this.hide();
      },
      bodyClass: Em.View.extend({
        templateName: require('templates/common/items_list_popup'),
        items: hostNames,
        insertedItems: [],
        didInsertElement: function () {
          lazyloading.run({
            destination: this.get('insertedItems'),
            source: this.get('items'),
            context: this,
            initSize: 100,
            chunkSize: 500,
            delay: 100
          });
        }
      })
    });
  },

  /**
   * Show notify that installation is manual
   * save hosts
   * @method manualInstallPopup
   */
  manualInstallPopup: function () {
    var self = this;
    App.ModalPopup.show({
      header: Em.I18n.t('installer.step2.manualInstall.popup.header'),
      onPrimary: function () {
        this.hide();
        self.saveHosts();
      },
      bodyClass: Em.View.extend({
        templateName: require('templates/wizard/step2ManualInstallPopup')
      })
    });
  },

  /**
   * Warn to manually install ambari-agent on each host
   * @method manualInstallWarningPopup
   */
  manualInstallWarningPopup: function () {
    if (!this.get('content.installOptions.useSsh')) {
      App.ModalPopup.show({
        header: Em.I18n.t('common.warning'),
        body: Em.I18n.t('installer.step2.manualInstall.info'),
        encodeBody: false,
        secondary: null
      });
    }
    this.set('content.installOptions.manualInstall', !this.get('content.installOptions.useSsh'));
  }.observes('content.installOptions.useSsh'),

  /**
   * Load java.home value frin server
   * @method setAmbariJavaHome
   */
  setAmbariJavaHome: function () {
    App.ajax.send({
      name: 'ambari.service',
      sender: this,
      success: 'onGetAmbariJavaHomeSuccess',
      error: 'onGetAmbariJavaHomeError'
    });
  },

  /**
   * Set received java.home value
   * @method onGetAmbariJavaHomeSuccess
   * @param {Object} data
   */
  onGetAmbariJavaHomeSuccess: function (data) {
    this.set('content.installOptions.javaHome', data.RootServiceComponents.properties['java.home']);
  },

  /**
   * Set default java.home value
   * @method onGetAmbariJavaHomeError
   */
  onGetAmbariJavaHomeError: function () {
    console.warn('can\'t get java.home value from server');
    this.set('content.installOptions.javaHome', App.get('defaultJavaHome'));
  },

  /**
   * Save hosts info and proceed to the next step
   * @method saveHosts
   */
  saveHosts: function () {
    this.set('content.hosts', this.getHostInfo());
    this.setAmbariJavaHome();
    App.router.send('next');
  }

});
