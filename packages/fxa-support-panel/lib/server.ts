/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as hapi from '@hapi/hapi';
import * as Scooter from '@hapi/scooter';
import * as Blankie from 'blankie';
import { Logger } from 'mozlog';
import Config from '../config';

import * as api from './api';

export type ServerEnvironment = 'production' | 'stage' | 'development';

export type ServerConfig = api.SupportConfig & {
  env: ServerEnvironment;
  listen: {
    host: string;
    port: number;
  };
};

export async function init(
  serverConfig: ServerConfig,
  logger: Logger
): Promise<hapi.Server> {
  const server = new hapi.Server({
    debug: serverConfig.env === 'production' ? false : { request: ['error'] },
    host: serverConfig.listen.host,
    port: serverConfig.listen.port,
  });

  api.init(logger, serverConfig, server);

  return server;
}
