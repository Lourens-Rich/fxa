/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const isA = require('joi');
const METRICS_CONTEXT_SCHEMA = require('../metrics/context').schema;
const validators = require('./validators');

const { HEX_STRING, BASE_36 } = validators;

module.exports = (log, db, mailer, config, customs) => {
  const unblockCodeLen = (config && config.codeLength) || 0;

  return [
    {
      method: 'POST',
      path: '/account/login/send_unblock_code',
      options: {
        validate: {
          payload: {
            email: validators.email().required(),
            metricsContext: METRICS_CONTEXT_SCHEMA,
          },
        },
      },
      handler: async function(request) {
        log.begin('Account.SendUnblockCode', request);

        const email = request.payload.email;
        let emailRecord;

        request.validateMetricsContext();

        const { flowId, flowBeginTime } = await request.app.metricsContext;

        await customs.check(request, email, 'sendUnblockCode');
        const uid = await lookupAccount();
        const code = await createUnblockCode(uid);
        await mailUnblockCode(code);
        await request.emitMetricsEvent('account.login.sentUnblockCode');
        return {};

        async function lookupAccount() {
          const record = await db.accountRecord(email);
          emailRecord = record;
          return record.uid;
        }

        async function createUnblockCode(uid) {
          return db.createUnblockCode(uid);
        }

        async function mailUnblockCode(code) {
          const emails = await db.accountEmails(emailRecord.uid);
          const geoData = request.app.geo;
          const {
            browser: uaBrowser,
            browserVersion: uaBrowserVersion,
            os: uaOS,
            osVersion: uaOSVersion,
            deviceType: uaDeviceType,
          } = request.app.ua;

          return mailer.sendUnblockCode(emails, emailRecord, {
            acceptLanguage: request.app.acceptLanguage,
            unblockCode: code,
            flowId,
            flowBeginTime,
            ip: request.app.clientAddress,
            location: geoData.location,
            timeZone: geoData.timeZone,
            uaBrowser,
            uaBrowserVersion,
            uaOS,
            uaOSVersion,
            uaDeviceType,
            uid: emailRecord.uid,
          });
        }
      },
    },
    {
      method: 'POST',
      path: '/account/login/reject_unblock_code',
      options: {
        validate: {
          payload: {
            uid: isA
              .string()
              .max(32)
              .regex(HEX_STRING)
              .required(),
            unblockCode: isA
              .string()
              .regex(BASE_36)
              .length(unblockCodeLen)
              .required(),
          },
        },
      },
      handler: async function(request) {
        log.begin('Account.RejectUnblockCode', request);

        const uid = request.payload.uid;
        const code = request.payload.unblockCode.toUpperCase();

        await db.consumeUnblockCode(uid, code);
        log.info('account.login.rejectedUnblockCode', {
          uid,
          unblockCode: code,
        });
        return {};
      },
    },
  ];
};
