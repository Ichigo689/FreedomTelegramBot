// RELIC DATA
require('newrelic');

var botToken = "263345256:AAGQVyxcJ6NFyRjYu9h-Iq6nS2QTBUM_NfE";
var mongoURL = process.env.MONGODB_URI || 'mongodb://heroku_7m7cx5b3:j1e3l4slk9tson1kd1n6pi0ccb@ds011705.mlab.com:11705/heroku_7m7cx5b3';
var botApi = require('node-telegram-bot-api');
var bot = new botApi(botToken, {polling: true});
var newImgSearch = require('g-i-s');
var schedule = require('node-schedule');
var cronJob = require('cron').CronJob;
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
            runningEvents[chatId].forEach((element, index) => {
                if (element.message === message) {
                    reject(`Event already exists! Try using "/addtime [time] [name]" instead`);
                }
            });
            // if (message in runningEvents[chatId]) {
            //     reject(`Event already exists! Try using "/addtime [time] [name]" instead.`);
            // }
        }
        resolve();
    });
}

// function newRecurrenceEvent(chatId, hour, minute, message) {
//     return new Promise((resolve, reject) => {
//         var object = {}; // MESSAGE OBJ
//         var placeHolder = {}; // Whole MDB OBJ
//         ensureEmptyMessage(chatId, message).then(() => {
//             // CURATE CHAT ARRAY
//             if (!(chatId in runningEvents)) {
//                 ensureEmptyObj(runningEvents[chatId]).then(() => {
//                     runningEvents[chatId] = [];
//                 });
//             }
//         }).then(() => {
//             // CURATE MESSAGE/RULE OBJECT
//             object.message = message;
//             object.times = [];
//             object.times.push({ rule: new schedule.RecurrenceRule()});
//             object.times[0].rule.hour = hour;
//             object.times[0].rule.minute = minute;
//         }).then(() => {
//             object.times[0].ruleInstance = schedule.scheduleJob(object.times[0].rule, () => {
//                 bot.sendMessage(chatId, message);
//             });
//         }).then(() => {
//             runningEvents[chatId].push(object);
//             placeHolder[chatId] = [object];
//         }).then(() => {
//             saveEvent(placeHolder).then(() => {
//                 resolve();
//             });
//         }).catch((error) => {
//             reject(error);
//         });
//     });
// }

function newRecurrenceEvent(chatId, hour, minute, message) {
    return new Promise((resolve, reject) => {
        var object = {};
        ensureEmptyMessage(chatId, message).then(() => {
            // Create chat array and check if event exists
            if (!(chatId in runningEvents)) {
                ensureEmptyObj(runningEvents[chatId]).then(() => {
                    runningEvents[chatId] = {
                        events: []
                    };
                });
            }
        }).then(() => {
            // Create rule OBJECT
            object.message = message;
            object.times = [{
                hour: hour,
                minute: minute
            }];
            var eventObject = { chatId: chatId };
            eventObject.event = [object];
            saveEvent(eventObject).then(() => {
                // make cron object after sending data to mongodb
                object.times[0].cron = new cronJob({
                    cronTime: `5 ${minute} ${hour} * * *`,
                    onTick: () => {
                    bot.sendMessage(chatId, message);
                },
                start: true});
            }).then(() => {
                runningEvents[chatId].events.push(object);
            }).then(() => {
                resolve();
            });
        }).catch((error) => {
            reject(error);
        });
    });
}

function saveEvent (eventObject) {
    // console.log(util.inspect(eventObject, {showHidden: false, depth: 10}));
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

function findEvent (chatId, message) {
    return new Promise((resolve, reject) => {
        mongo.connect(mongoURL, (error, db) => {
            assert.equal(null, error);
            // var searchObject = {}
            // searchObject[chatId] = [{message: message}];
            var cursor = db.collection('Events').find({
                "chatId": chatId,
                "event.message": message
            }).each((error, document) => {
                assert.equal(null, error);
                if (document) {
                    db.close();
                    resolve(document);
                }
                db.close();
            });
        });
    });
}

function deleteEvent (chatId, message) {
    return new Promise((resolve, reject) => {
        findEvent(chatId, message).then((document) => {
            mongo.connect(mongoURL, (error, db) => {
                assert.equal(null, error);
                var cursor = db.collection('Events').deleteOne({
                    "chatId": chatId,
                    "event.message": message
                }, (error, results) => {
                    if (!error) {
                        runningEvents[chatId].events.forEach((element, index) => {
                            if (element.message === message) {
                                runningEvents[chatId].events[index].times.forEach((eventE, eventI) => {
                                    runningEvents[chatId].events[index].times[eventI].cron.stop();
                                });
                                runningEvents[chatId].events.splice(index, 1);
                            }
                        });
                        console.log(runningEvents[chatId].events);
                        resolve();
                    }
                });
            });
        });
    });
}

function addEventTime (message, eventTime) {

}


// BOT COMMANDS


bot.onText(/^\/freedom/, (msg, match) => {
    var randSearch = Math.floor((Math.random() * searches.length) + 1);
    getImage(searches[randSearch]).then((result) => {
        var randImg = Math.floor((Math.random() * result.length) + 1);
        console.log(searches[randSearch], randSearch);
        bot.sendMessage(msg.chat.id, result[randImg].url);
    }).catch((error) => {
        console.log(error);
    });
});

bot.onText(/^\/blaze/, (msg, match) => {
    getImage('fire').then((result) => {
        var randImg = Math.floor((Math.random() * result.length) + 1);
        console.log('Blaze:', randImg);
        bot.sendMessage(msg.chat.id, ('Blayz ' + result[randImg].url));
    });
});

// bot.onText(/^\/yt ?([.\d]{0,2}) (.+)/, (msg, match) => {
//     var ytNumber = match[1] ? Number(match[1]) : 0;
//     console.log('ytSearch', match[2]);

// });

bot.onText(/pull(?:ed|ing)? out/i, (msg, match) => {
    bot.sendMessage(msg.chat.id, 'Excuse me? Say you\'re sorry\nNever ever pull out. - EP');
});

// bot.onText(/fuck you/i, (msg, match) => {
//     bot.sendMessage(msg.chat.id, 'Yeah fuck you too!');
// });

bot.onText(/^fuck$/i, (msg, match) => {
    bot.sendMessage(msg.chat.id, `"Fuck" is a bad word. I prefer anal fisting. - EP`);
});

bot.onText(/^fuck (?:the|tha|da) (?:police)/i, (msg, match) => {
    bot.sendMessage(msg.chat.id, `Comin' straight from the underground.`);
});

bot.onText(/^\/img ?([.\d]{0,3}) (.+)/, (msg, match) => {
    if (match[2] === 'penis') {
        bot.sendMessage(msg.chat.id, 'why would you do that??!!');
    }
    var imgNumber = match[1] ? Number(match[1]) : 0;
    console.log('imgSearch', match[2]);
    getImage(match[2]).then((result) => {
        bot.sendMessage(msg.chat.id, result[imgNumber].url);
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
        var stringMinute = (minute === 0) ? '00' : match[2];
        newRecurrenceEvent(msg.chat.id, hour24, minute, match[4]).then(() => {
            bot.sendMessage(msg.chat.id, `"${match[4]}" will be repeated at ${hour}:${stringMinute} ${timeType}`);
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
        if (hour24 === 0) {
            hour = '00';
        }
        var minute = Number(match[6]);
        var stringMinute = minute;
        var stringMinute = (minute === 0) ? '00' : match[6];
        newRecurrenceEvent(msg.chat.id, hour24, minute, match[7]).then(() => {
            bot.sendMessage(msg.chat.id, `"${match[7]}" will be repeated at ${hour}:${stringMinute} ${timeType}`);
        }).catch((error) => {
            bot.sendMessage(msg.chat.id, error);
        });
    }
});

bot.onText(/^\/(?:deleteevent) (.+)$/, (msg, match) => {
    deleteEvent(msg.chat.id, match[1]).then((result) => {
        bot.sendMessage(msg.chat.id, `${match[1]} will no longer be repeated`);
    });
    // deleteRecurrence(msg.chat.id, match[1]).then(() => {
    //     bot.sendMessage(msg.chat.id, `"${match[1]}" no more!`)
    // });
});

// Testing thing

bot.onText(/^\/iterate/, (msg, match) => {
    var iteration = 1;
    var test = new cronJob({
                    cronTime: `0 */5 * * * *`,
                    onTick: () => {
                    bot.sendMessage(msg.chat.id, iteration);
                    iteration++;
                },
                start: true});
});

bot.onText(/^\/listevents/, (msg, match) => {
    console.log(runningEvents[msg.chat.id].events);
});