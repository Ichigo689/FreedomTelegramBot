// RELIC DATA
require('newrelic');

var botToken = "201884053:AAHFcpWnYYkt2RdJDfyZZ9z2C40aK9_AVVc";
var mongoURL = 'mongodb://heroku_7m7cx5b3:j1e3l4slk9tson1kd1n6pi0ccb@ds011705.mlab.com:11705/heroku_7m7cx5b3' || process.env.MONGODB_URI;
var botApi = require('node-telegram-bot-api');
var bot = new botApi(botToken, {polling: true});
var newImgSearch = require('g-i-s');
var schedule = require('node-schedule');
var mongo = require('mongodb').MongoClient;
var assert = require('assert');
var express = require('express');
var app = express();
var util = require('util');

app.set('port', (process.env.PORT || 5000));

//For avoiding Heroku $PORT error
app.get('/', function(request, response) {
    var result = 'App is running'
    response.send(result);
}).listen(app.get('port'), function() {
    console.log('App is running, server is listening on port ', app.get('port'));
});




// BOT FUNCTIONS

var searches = [
    'American Flag',
    'Statue of Liberty',
    'America',
    'American Freedom',
    'American Constitution',
    'Uncle Sam',
    'Monster Truck',
    'American Flag Car',
    `'Murica`,
    'Merica',
    '1950s Cars',
    'Bald Eagle',
    'FBI',
    'CIA',
    'US Government',
    'United States',
    'M16',
    'Texas',
    'Cowboys',
    'Patriots',
    'American Bald Eagle',
    'Burger',
    'Hot Dog'
]

var runningEvents = {};

function getImage(query) {
    return new Promise((resolve, reject) => {
        newImgSearch(query, (error, results) => {
            if (!error) {
                resolve(results);
            } else {
                reject(error);
            }
        });
    });
}

function ensureEmptyObj(obj) {
    return new Promise((resolve, reject) => {
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                reject();
            }
        }
        resolve();
    });
}

function ensureEmptyMessage(chatId, message) {
    return new Promise((resolve, reject) => {
        if (chatId in runningEvents) {
            if (message in runningEvents[chatId]) {
                reject(`Event already exists! Try using "/addtime [time] [name]" instead.`);
            }
        }
        resolve();
    });
}

function newRecurrenceEvent(chatId, hour, minute, message) {
    return new Promise((resolve, reject) => {
        var placeHolder = {};
        ensureEmptyMessage(chatId, message).then(() => {
            if (!(chatId in runningEvents)) {
                ensureEmptyObj(runningEvents[chatId]).then(() => {
                    runningEvents[chatId] = {};
                });
            }
        }).then(() => {
            placeHolder.chatInstance = runningEvents[chatId];
            placeHolder.chatInstance[message] = [];
            placeHolder.recurrence = placeHolder.chatInstance[message];
            placeHolder.rule = { rule: {} };
        }).then(() => {
            placeHolder.rule.rule = new schedule.RecurrenceRule();
            placeHolder.rule.rule.hour = hour;
            placeHolder.rule.rule.minute = minute;
        }).then(() => {
            var recurrence = placeHolder.chatInstance[message];
            recurrence.push(placeHolder.rule);
        }).then(() => {
            resolve(placeHolder);
        }).catch((error) => {
            reject(error);
        });
    });
}

function makeRecurrence(chatId, hour, minute, message) {
    return new Promise((resolve, reject) => {
        newRecurrenceEvent(chatId, hour, minute, message).then((placeHolder) => {
            var recurrence = placeHolder.chatInstance[message];
            recurrence[0].ruleInstance = schedule.scheduleJob(recurrence[0].rule, () => {
                bot.sendMessage(chatId, message);
            });
        }).then((result) => {
            console.log('runninEvents', util.inspect(runningEvents,{showHidden: true, depth: 8}));
            let eventObject = {};
            eventObject[chatId] = runningEvents[chatId];
            saveEvent(eventObject).then(() => {

            }).catch((error) => {
                reject(error);
            })
        }).then(() => {
            resolve();
        }).catch((error) => {
            reject(error);
        });
    });
}

function saveEvent (eventObject) {
    return new Promise((resolve, reject) => {
        mongo.connect(mongoURL, (error, db) => {
            assert.equal(null, error);
            
            db.collection('Events').insertOne(eventObject, (error, result) => {
                assert.equal(null, error);
                db.close();
                resolve();
            });
        });
    });
}

function findEvent (chatId, eventName) {
    return new Promise((resolve, reject) => {
        var eventDocument = {};
        mongo.connect(mongoURL).then((error, db) => {
            assert.equal(null, error);
            var searchObject = {};
            searchObject[chatId].name = eventName;
            var cursor = db.collection('Events').find(JSON.stringify(searchObject));
            cursor.each().then((error, document) => {
                assert.equal(null, error);
                if (document != null) {
                    eventDocument.document.push(document);
                    eventDocument.statusCode = 200;
                }
            }).then(() => {
                db.close();
            }).then(() => {
                if (eventDocument.statusCode === 200) {
                    resolve(eventDocument);
                } else {
                    eventDocument.statusCode = 404;
                    resolve(eventDocument);
                }
            });
        }).catch((error) => {
            eventDocument.document = error;
            eventDocument.statusCode = 400;
            reject(eventDocument);
        });
    });
}

function addEventTime (eventName, eventTime) {

}


// BOT COMMANDS


bot.onText(/^\/freedom/, (msg, match) => {
    var randSearch = Math.floor((Math.random() * searches.length) + 1);
    getImage(searches[randSearch]).then((result) => {
        var randImg = Math.floor((Math.random() * result.length) + 1);
        console.log(searches[randSearch], randSearch);
        bot.sendMessage(msg.chat.id, ('Searching for ' + searches[randSearch]) + ' ' + result[randImg].url);
    });
});

bot.onText(/^\/blaze/, (msg, match) => {
    getImage('fire').then((result) => {
        var randImg = Math.floor((Math.random() * result.length) + 1);
        console.log('Blaze:', randImg);
        bot.sendMessage(msg.chat.id, ('Blayz ' + result[randImg].url));
    });
});

bot.onText(/^\/img (.+)/, (msg, match) => {
    if (match[1] === 'penis') {
        bot.sendMessage(msg.chat.id, 'why would you do that??!!');
    }
    console.log('imgSearch', match[1]);
    getImage(match[1]).then((result) => {
        bot.sendMessage(msg.chat.id, result[0].url);
    });
});

bot.onText(/^\/(?:addevent) (?:([0-9]|1[0-2]):?([0-5][0-9]) ?(?:([apAP])[.]?[mM]?[.]?) (.+)$|([01][0-9]|2[0-3]):?([0-5][0-9]) (.+)$)/, (msg, match) => {

    if (match[1] !== undefined) { // IN 12-HOUR FORMAT
        var hour = Number(match[1]);
        var hour24 = hour;
        var timeType = 'a.m.';
        if (match[3] === 'p' || match[3] === 'P') {
            timeType = 'p.m.';
            hour24 = hour + 12;
        }
        var minute = Number(match[2]);
        makeRecurrence(msg.chat.id, hour24, minute, match[4]).then(() => {
            bot.sendMessage(msg.chat.id, `Saved (but not reloaded) Event: ${match[4]} will be repeated at ${hour}:${minute} ${timeType}`);
        }).catch((error) => {
            bot.sendMessage(msg.chat.id, error);
        });
    } else {
        var hour24 = Number(match[5]);
        var hour = hour24;
        var timeType = 'a.m.';
        if (hour24 > 12) {
            hour = hour - 12;
            timeType = 'p.m.';
        }
        var minute = Number(match[6]);
        makeRecurrence(msg.chat.id, hour24, minute, match[7]).then(() => {
            bot.sendMessage(msg.chat.id, `Saved (but not reloaded) Event: ${match[7]} will be repeated at ${hour}:${minute} ${timeType}`);
        });
    }
});
