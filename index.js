/* eslint no-use-before-define: "off" */
const ExpirationCalculator = require('./expireCalc/expireCalc');

const defaultOpts = {
    host: '127.0.0.1',
    port: 6379,
    connect_timeout: 10000
};


/**
 * Auto Expiring seneca module decalaration
 * @module VehicleService
 * @param options The connection info for connecting to redis
 * @returns {object} - Name 'dr-vehicle'
 */
module.exports = function (options) {
    const seneca = this;
    const PLUGIN_NAME = 'dr-autoexp-cache';
    const opts = seneca.util.deepextend(defaultOpts, options);

    // use the redis-cache
    seneca.use('seneca-redis-cache', opts);

    seneca.add({ role: 'cache', cmd: 'set', expire: 'seconds' }, expireInSeconds);
    seneca.add({ role: 'cache', cmd: 'set', expire: 'date' }, expireOnDate);
    seneca.add({ role: 'cache', cmd: 'set', expire: 'date', trustIssues: true }, expireOnDateWithTrustIssues);
    // seneca.add({ role: 'cache', cmd: 'set', expire: 'time', timeUnits: '*' }, expireWithTimeUnit);

    return {
        name: PLUGIN_NAME
    };
};

function doPrecheck(data) {
    return data.key && (data.expirationDate || data.expirationSeconds);
}

/**
 * Set a key to expire in a defined set of seconds. The msg incoming requires a msg.expirationSeconds which is > 0.
 * @param {Object} msg
 * @param {Function} done
 */
function expireInSeconds(msg, done) {
    const seneca = this;
    const logger = seneca.log;

    if (!msg.expirationSeconds || msg.expirationSeconds <= 0) {
        logger.error(`Cache provided bad data for key: ${msg.key}: target expiration in seconds was ${msg.expirationSeconds}. Key/value not cached.`);
        done(null); // return null as result of cache set
    }

    cacheData(msg.key, msg.value, msg.expirationSeconds, done);
}

/**
 * Set a single target time for a key to expire. Example: Expire a key/value at the first of the month.
 * @param {Object} msg
 * @param {Function} done
 */
function expireOnDate(msg, done) {
    const seneca = this;
    const logger = seneca.log;

    // figure out number of seconds from then to now.

    const targetExpireDate = msg.expirationDate;

    // attempt to pare date
    // if !date || !in future, send back null


    const expiration = ExpirationCalculator.expireOnDate(targetExpireDate);
    cacheData(expiration, done);
}

/**
 * Similar to expireOnDate with an added check to make sure we only cache data AFTER a certain time period.
 * Example: Expire on the 1st of the month but only start caching again after the first 7 days.
 * @param {Object} msg
 * @param {Function} done
 */
function expireOnDateWithTrustIssues(msg, done) {
    done(null);
}

function cacheData(key, value, time, done) {
    const seneca = this;
    const logger = seneca.log;

    // call the cache set command to persist the data here. The expire was added in the original seneca-redis because the
    // redis client actually contains the set command to send additional data. It's possible that we'll just use the
    // npm redis client ourselves in here to gain additional commands not exposed in the seneca-redis plugin.
    seneca.act({ role: 'cache', cmd: 'set', key, value, expire: time }, (err, out) => {
        // intercept here
        if (err) {
            logger.info(`Logger result: error ${err}`);
        } else {
            logger.info(`Logger result: success ${out}`);
        }

        done(err || out);
    });
}
