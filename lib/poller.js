const _ = require('lodash');
const {timer, from, of, combineLatest} = require('rxjs');
const {flatMap, filter, map, retry, catchError} = require('rxjs/operators');
const {config} = require('./config');
const api = require('./api');

const MINIMAL_POLLING_INTERVAL = 15000;
const MINIMAL_AUTHENTICATION_INTERVAL = 3600000;

module.exports = {
    pollFavoriteBusinesses
};

function pollFavoriteBusinesses() {
    const pollingIntervalInMs = getInterval('api.pollingIntervalInMs', MINIMAL_POLLING_INTERVAL);
    const authenticationIntervalInMs = getInterval('api.authenticationIntervalInMS', MINIMAL_AUTHENTICATION_INTERVAL);

    const authentication$ = timer(0, authenticationIntervalInMs).pipe(
        flatMap(() => from(api.login()).pipe(
            retry(2),
            catchError(logError),
            filter(authentication => !!authentication)
        ))
    );

    return combineLatest([timer(0, pollingIntervalInMs), authentication$]).pipe(
        flatMap(() => from(api.listFavoriteBusinesses()).pipe(
            retry(2),
            catchError(logError),
            filter(response => !!_.get(response, 'items')),
            map(response => response.items)
        ))
    );
}

function logError(error) {
    console.error(`Error ${_.get(error, 'statusCode')} during ${_.get(error, 'options.method')} ${_.get(error, 'options.baseUrl')}${_.get(error, 'options.url')}:
${JSON.stringify(_.get(error, 'response.body.errors'), null, 4)}`);
    return of(null);
}

function getInterval(configPath, minimumIntervalInMs) {
    const configuredIntervalInMs = config.get(configPath);
    return _.isFinite(configuredIntervalInMs) ?
        Math.max(configuredIntervalInMs, minimumIntervalInMs) :
        minimumIntervalInMs;
}
