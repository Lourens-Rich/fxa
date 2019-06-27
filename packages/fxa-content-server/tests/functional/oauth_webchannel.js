/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { registerSuite } = intern.getInterface('object');
const TestHelpers = require('../lib/helpers');
const FunctionalHelpers = require('./lib/helpers');

const PASSWORD = 'passwordzxcv';

let email;

const {
  click,
  closeCurrentWindow,
  fillOutSignUp,
  openFxaFromRp,
  openVerificationLinkInNewTab,
  switchToWindow,
  testElementExists,
  testElementTextInclude,
  testIsBrowserNotified,
  testUrlInclude,
} = FunctionalHelpers;

registerSuite('oauth webchannel', {
  beforeEach: function() {
    email = TestHelpers.createEmail();

    return this.remote.then(
      FunctionalHelpers.clearBrowserState({
        '123done': true,
        contentServer: true,
        force: true,
      })
    );
  },
  tests: {
    'signup, verify same browser': function() {
      return (
        this.remote
          .then(
            openFxaFromRp('signup', {
              query: {
                context: 'oauth_webchannel_v1',
              },
              webChannelResponses: {
                'fxaccounts:can_link_account': { ok: true },
                'fxaccounts:fxa_status': {
                  capabilities: null,
                  signedInUser: null,
                },
              },
            })
          )
          .then(testElementExists('#fxa-signup-header .service'))
          .then(testUrlInclude('client_id='))
          .then(testUrlInclude('redirect_uri='))
          .then(testUrlInclude('state='))
          .then(testUrlInclude('context='))

          .then(fillOutSignUp(email, PASSWORD))

          .then(testElementExists('#choose-what-to-sync'))
          .then(click('button[type="submit"]'))

          .then(testElementExists('#fxa-confirm-header'))
          .then(openVerificationLinkInNewTab(email, 0))

          .then(switchToWindow(1))
          // wait for the verified window in the new tab
          .then(testElementExists('#fxa-sign-up-complete-header'))
          // user sees the name of the RP, but cannot redirect
          .then(testElementTextInclude('.account-ready-service', '123done'))

          // switch to the original window
          .then(closeCurrentWindow())
          .then(testIsBrowserNotified('fxaccounts:oauth_login'))
      );
    },
  },
});
