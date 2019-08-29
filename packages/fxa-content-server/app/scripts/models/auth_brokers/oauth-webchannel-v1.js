/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * WebChannel OAuth broker that speaks 'v1' of the protocol.
 */

import _ from 'underscore';
import ChannelMixin from './mixins/channel';
import Cocktail from 'cocktail';
import Constants from '../../lib/constants';
import HaltBehavior from '../../views/behaviors/halt';
import OAuthRedirectAuthenticationBroker from './oauth-redirect';
import ScopedKeys from 'lib/crypto/scoped-keys';
import WebChannel from '../../lib/channels/web';
import SyncEngines from '../sync-engines';

const proto = OAuthRedirectAuthenticationBroker.prototype;

const OAuthWebChannelBroker = OAuthRedirectAuthenticationBroker.extend({
  defaultBehaviors: _.extend({}, proto.defaultBehaviors, {
    afterForceAuth: new HaltBehavior(),
    afterSignIn: new HaltBehavior(),
  }),

  defaultCapabilities: _.extend({}, proto.defaultCapabilities, {
    chooseWhatToSyncWebV1: true,
    fxaStatus: true,
    openWebmailButtonVisible: false,
  }),

  commands: _.pick(WebChannel, 'FXA_STATUS', 'OAUTH_LOGIN'),

  type: 'oauth-webchannel-v1',

  initialize(options = {}) {
    this.session = options.session;
    this._channel = options.channel;
    this._scopedKeys = ScopedKeys;
    this._metrics = options.metrics;

    proto.initialize.call(this, options);

    this.request(
      this.getCommand('FXA_STATUS', {
        service: this.relier.get('service'),
      })
    ).then(response => this.onFxaStatus(response));
  },

  /**
   * Handle a response to the `fxa_status` message.
   *
   * @param {any} [response={}]
   * @private
   */
  onFxaStatus(response = {}) {
    const supportedEngines =
      response.capabilities && response.capabilities.engines;
    if (supportedEngines) {
      // supportedEngines override the defaults
      const syncEngines = new SyncEngines(null, {
        engines: supportedEngines,
        window: this.window,
      });
      return this.set('chooseWhatToSyncWebV1Engines', syncEngines);
    }
  },

  /**
   * Get a reference to a channel. If a channel has already been created,
   * the cached channel will be returned. Used by the ChannelMixin.
   *
   * @method getChannel
   * @returns {Object} channel
   */
  getChannel() {
    if (!this._channel) {
      this._channel = this.createChannel();
    }

    return this._channel;
  },

  createChannel() {
    const channel = new WebChannel(Constants.ACCOUNT_UPDATES_WEBCHANNEL_ID);
    channel.initialize({
      window: this.window,
    });

    return channel;
  },

  DELAY_BROKER_RESPONSE_MS: 100,

  sendOAuthResultToRelier(result, account) {
    return this._metrics.flush().then(() => {
      const extraParams = {};
      if (result.error) {
        extraParams.error = result.error;
      }
      if (result.action) {
        extraParams.action = result.action;
      }

      result.redirect = Constants.OAUTH_WEBCHANNEL_REDIRECT;

      return this.send(this.getCommand('OAUTH_LOGIN'), result);
    });
  },

  getCommand(commandName) {
    if (!this.commands) {
      throw new Error('this.commands must be specified');
    }

    const command = this.commands[commandName];
    if (!command) {
      throw new Error('command not found for: ' + commandName);
    }

    return command;
  },
});

Cocktail.mixin(OAuthWebChannelBroker, ChannelMixin);

export default OAuthWebChannelBroker;
