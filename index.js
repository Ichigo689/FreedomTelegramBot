// RELIC DATA
require('newrelic');

var botToken = "263345256:AAGQVyxcJ6NFyRjYu9h-Iq6nS2QTBUM_NfE";
var mongoURL = process.env.MONGODB_URI || 'mongodb://heroku_7m7cx5b3:j1e3l4slk9tson1kd1n6pi0ccb@ds011705.mlab.com:11705/heroku_7m7cx5b3';
var botApi = require('node-telegram-bot-api');
var bot = new botApi(botToken, { polling: true });
var newImgSearch = require('g-i-s');
var cowsay = require('cowsay');
// var schedule = require('node-schedule');
var cronJob = require('cron').CronJob;
var mongo = require('mongodb').MongoClient;
var assert = require('assert');
var express = require('express');
var app = express();
var util = require('util');

app.set('port', (process.env.PORT || 5000));

//For avoiding Heroku $PORT error
app.get('/', function (request, response) {
    var result = 'App is running'
    response.send(result);
}).listen(app.get('port'), function () {
    console.log('App is running, server is listening on port ', app.get('port'));
});

// INITIALIZING Events
initializeEvents();


// BOT FUNCTIONS
var runningEvents = {};

function getImage(query) {
    return new Promise((resolve, reject) => {
        newImgSearch(query, (error, results) => {
            if (!error) { resolve(results) };
            reject(error);
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
            runningEvents[chatId].events.forEach((element, index) => {
                if (element.message === message) {
                    reject(`Event already exists! Try using "/addtime [time] [name]" instead`);
                }
            });
        }
        resolve();
    });
}

function ensureEmptyTime(chatId, hour, minute, message) {
    return new Promise((resolve, reject) => {
        var eventIndex = null;
        runningEvents[chatId].events.forEach((element, index) => {
            if (element.message === message) {
                eventIndex = index;
                element.times.forEach((tElement, tIndex) => {
                    if (element.hour === hour && element.minute === minute) {
                        reject(`Event already exists! try using "/addtime [time] [name]" instead`);
                    }
                });
            }
        });
        resolve(eventIndex);
    });
}

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
                    cronTime: `1 ${minute} ${hour} * * *`,
                    onTick: () => {
                        bot.sendMessage(chatId, message);
                    },
                    start: true,
                    timeZone: 'America/New_York'
                });
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

function newRecurrenceTime(chatId, hour, minute, message) {
    return new Promise((resolve, reject) => {
        ensureEmptyMessage(chatId, message).then(() => {
            reject(`Event does not exist! Use "/addevent [time] [name]" to add a new event`);
        }).catch(() => {
            ensureEmptyTime(chatId, hour, minute, message).then((eventIndex) => {
                var timesObject = {
                    hour: hour,
                    minute: minute
                };
                addEventTime(chatId, timesObject, message).then(() => {
                    timesObject.cron = new cronJob({
                        cronTime: `5 ${minute} ${hour} * * *`,
                        onTick: () => {
                            bot.sendMessage(chatId, message);
                        },
                        start: true,
                        timeZone: 'America/New_York'
                    });
                    runningEvents[chatId].events[eventIndex].times.push(timesObject);
                }).then(() => {
                    resolve();
                });
            }).catch((error) => {
                reject(error);
            });
        });
    });
}

function saveEvent(eventObject) {
    return new Promise((resolve, reject) => {
        findEvent(eventObject.chatId).then(() => {
            findMessage(eventObject.chatId, eventObject.event[0].message).then(() => {
                mongo.connect(mongoURL, (error, db) => {
                    assert.equal(null, error);
                    db.collection('Events').find({
                        'chatId': eventObject.chatId,
                        'event.message': eventObject.event[0].message
                    }).each((error, document) => {
                        assert.equal(null, error);
                        if (document) {
                            document.event.forEach((element, index) => {
                                if (element.message === eventObject.event[0].message) {
                                    document.event[index].times.push(eventObject.event[0].times);
                                }
                            });
                        }
                        db.collection('Events').findOneAndReplace({
                            'chatId': eventObject.chatId,
                            'event.message': eventObject.event[0].message
                        },
                            document, {
                                returnOriginal: false
                            }, (error, result) => {
                                assert.equal(null, error);
                                db.close();
                                resolve();
                            });
                    });
                });
            }).catch(() => {
                mongo.connect(mongoURL, (error, db) => {
                    assert.equal(null, error);
                    var cursor = db.collection('Events').find({
                        "chatId": eventObject.chatId
                    }).each((error, document) => {
                        assert.equal(null, error);
                        if (document) {
                            document.event.push(eventObject.event[0]);
                            db.collection('Events').findOneAndReplace({
                                "chatId": eventObject.chatId
                            },
                                document, {
                                    returnOriginal: false
                                }, (error, result) => {
                                    assert.equal(null, error);
                                    db.close();
                                    resolve();
                                });
                        }
                    });
                });
            });
        }).catch(() => {
            mongo.connect(mongoURL, (error, db) => {
                db.collection('Events').insertOne(eventObject, (error, result) => {
                    assert.equal(null, error);
                    db.close();
                    resolve();
                });
            });
        });
    });
}

function findEvent(chatId) {
    return new Promise((resolve, reject) => {
        mongo.connect(mongoURL, (error, db) => {
            assert.equal(null, error);
            db.collection('Events').find({
                "chatId": chatId
            }).each((error, document) => {
                assert.equal(null, error);
                if (document) {
                    if ('chatId' in document) {
                        resolve();
                        db.close();
                    } else {
                        reject();
                    }
                } else {
                    reject();
                }
            });
        });
    });
}

function findMessage(chatId, message) {
    return new Promise((resolve, reject) => {
        mongo.connect(mongoURL, (error, db) => {
            assert.equal(null, error);
            var cursor = db.collection('Events').find({
                "chatId": chatId,
                "event.message": message
            }).each((error, document) => {
                assert.equal(null, error);
                if (document) {
                    if ('chatId' in document) {
                        resolve();
                        db.close();
                    } else {
                        reject();
                    }
                } else {
                    reject();
                }
            });
        });
    });
}

function deleteEvent(chatId, message) {
    return new Promise((resolve, reject) => {
        findMessage(chatId, message).then((document) => {
            mongo.connect(mongoURL, (error, db) => {
                assert.equal(null, error);
                db.collection('Events').find({
                    'chatId': chatId,
                    'event.message': message
                }).each((error, document) => {
                    assert.equal(null, error);
                    if (document) {
                        document.event.forEach((element, index) => {
                            if (element.message === message) {
                                document.event.splice(index, 1);
                            }
                        });
                        db.collection('Events').findOneAndReplace({
                            'chatId': chatId,
                            'event.message': message
                        },
                            document, {
                                returnOriginal: false
                            }, (error, result) => {
                                assert.equal(null, error);
                                db.close();
                                runningEvents[chatId].events.forEach((element, index) => {
                                    if (element.message === message) {
                                        runningEvents[chatId].events[index].times.forEach((eventE, eventI) => {
                                            runningEvents[chatId].events[index].times[eventI].cron.stop();
                                        });
                                        runningEvents[chatId].events.splice(index, 1);
                                    }
                                });
                                resolve();
                            });
                    }
                });
            });
        });
    });
}

function addEventTime(chatId, timeObject, message) {
    return new Promise((resolve, reject) => {
        findMessage(chatId, message).then((document) => {
            mongo.connect(mongoURL, (error, db) => {
                assert.equal(null, error);
                var cursor = db.collection('Events').find({
                    "chatId": chatId,
                    "event.message": message
                }).each((error, document) => {
                    assert.equal(null, error);
                    if (document) {
                        document.event.forEach((element, index) => {
                            if (element.message === message) {
                                document.event[index].times.push(timeObject);
                            }
                        });
                        db.collection('Events').findOneAndReplace({
                            "chatId": chatId,
                            "event.message": message
                        },
                            document, {
                                returnOriginal: false
                            }, (error, result) => {
                                assert.equal(null, error);
                                db.close();
                                resolve();
                            });
                    }
                });
            });
        });
    });
}

function initializeEvents() {
    mongo.connect(mongoURL, (error, db) => {
        assert.equal(null, error);
        var cursor = db.collection('Events').find().each((error, document) => {
            assert.equal(null, error);
            var runningObject = {};
            if (document) {
                if (!(document.chatId in runningObject)) {
                    runningObject[document.chatId] = { events: [] };
                }
                document.event.forEach((element, index) => {
                    var object = {};
                    object.message = element.message;
                    object.times = [];
                    objectTimesCount = 0;
                    element.times.forEach((tElement, tIndex) => {
                        object.times.push(tElement);
                        object.times[objectTimesCount].cron = new cronJob({
                            cronTime: `1 ${tElement.minute} ${tElement.hour} * * *`,
                            onTick: () => {
                                bot.sendMessage(document.chatId, element.message);
                            },
                            start: true,
                            timeZone: 'America/New_York'
                        });
                    });
                    runningObject[document.chatId].events.push(object);
                });
                runningEvents = runningObject;
            }
        });
    });
}

function inABit() {

}


// BOT COMMANDS


bot.onText(/^\/freedom/, (msg, match) => {
    var searches = ['American Flag', 'Statue of Liberty', 'America', 'American Freedom', 'American Constitution', 'Uncle Sam', 'Monster Truck', 'American Flag Car', `'Murica`, 'Merica', '1950s Cars', 'Bald Eagle', 'US Government', 'United States', 'M16', 'M4', 'Texas', 'American Bald Eagle', 'Burger', 'Hot Dog'];
    var randSearch = Math.floor((Math.random() * searches.length));
    getImage(searches[randSearch]).then((result) => {
        var randImg = Math.floor((Math.random() * result.length));
        console.log(searches[randSearch], randSearch);
        bot.sendMessage(msg.chat.id, result[randImg].url);
    }).catch((error) => {
        console.log(error);
    });
});

bot.onText(/^\/blaze/, (msg, match) => {
    getImage('fire').then((result) => {
        var randImg = Math.floor((Math.random() * result.length));
        console.log('Blaze:', randImg);
        bot.sendMessage(msg.chat.id, ('Blayz ' + result[randImg].url));
    });
});

// bot.onText(/^\/yt ?([.\d]{0,2}) (.+)/, (msg, match) => {
//     var ytNumber = match[1] ? Number(match[1]) : 0;
//     console.log('ytSearch', match[2]);

// });

bot.onText(/(?:(never)|(don(?:')t)|(won(?:')t|(not)|(no)))? ?pull(?:ed|ing)? out/i, (msg, match) => {
    if (!match[1]) {
        bot.sendMessage(msg.chat.id, 'Excuse me? Say you\'re sorry\nNever ever pull out. - EP').then((result) => {
            console.log('result', result);
        });
        bot.onReplyToMessage(msg.chat.id, msg.message_id, (reply) => {
            var replyRegEx = /(?:sorry)|(?:whip out)|(?:(?:never)(?:pull out)?)/i;

            if (replyRegEx.test(reply.reply_to_message.text)) {
                bot.sendMessage(msg.chat.id, 'Good.');
            }
        });
    }
});

// bot.onText(/fuck you/i, (msg, match) => {
//     bot.sendMessage(msg.chat.id, 'Yeah fuck you too!');
// });

bot.onText(/^fuck$/i, (msg, match) => {
    var remark = ["anal fisting", "anal fishing", "oral fisting", "oral fishing"];
    var randRemark = Math.floor((Math.random() * remark.length));

    bot.sendMessage(msg.chat.id, `"Fuck" is a bad word. I prefer ${remark[randRemark]}.`);
});

bot.onText(/(?:how\?)/i, (msg, match) => {
    bot.sendMessage(msg.chat.id, `Fuck if I know.`);
});

bot.onText(/(?:why\?)/i, (msg, match) => {
    bot.sendMessage(msg.chat.id, `Because fuck you that's why.`);
});

bot.onText(/I swear to fuck$/i, (msg, match) => {
    var remark = [`I'll fucking kiss you on the mouth.`, `I'll fucking kill you in your sleep.`];
    var randRemark = Math.floor((Math.random() * remark.length));
    bot.sendMessage(msg.chat.id, remark[randRemark]);
});

bot.onText(/guess what?/i, (msg, match) => {
    var remark = [`Fucked your mom last night.`, `Did your mom last night`, `Did\nYour\nMom!`];
    var randRemark = Math.floor((Math.random() * remark.length));
    bot.sendMessage(msg.chat.id, remark[randRemark]);
});

bot.onText(/^fuck (?:the|tha|da) (?:police)/i, (msg, match) => {
    bot.sendMessage(msg.chat.id, `Comin' straight from the underground.`);
});

bot.onText(/ain'?t nothing to it$/i, (msg, match) => {
    bot.sendMessage(msg.chat.id, `Gangsta rap made me do it.`);
});

bot.onText(/^solid/i, (msg, match) => {
    bot.sendMessage(msg.chat.id, `I've been at half mast for the past hour.`);
});

// bot.onText(/(?:t(?:hank(?:s))?) *(?:you|u|)/i, (msg, match) => {
//     bot.sendMessage(msg.chat.id, `love you long time`);
// });

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

bot.onText(/^\/(?:addtime) (?:([0-9]|1[0-2]):?([0-5][0-9]) ?(?:([apAP])[.]?[mM]?[.]?) (.+)$|([01][0-9]|2[0-3]):?([0-5][0-9]) (.+)$)/, (msg, match) => {
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
        newRecurrenceTime(msg.chat.id, hour24, minute, match[4]).then(() => {
            bot.sendMessage(msg.chat.id, `"${match[4]}" will be repeated at ${hour}:${stringMinute} ${timeType} as well`);
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
        newRecurrenceTime(msg.chat.id, hour24, minute, match[7]).then(() => {
            bot.sendMessage(msg.chat.id, `"${match[7]}" will be repeated at ${hour}:${stringMinute} ${timeType} as well`);
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

bot.onText(/^\/listevents/, (msg, match) => {
    var eventString = 'All events';
    if (runningEvents[msg.chat.id] && runningEvents[msg.chat.id].events.length > 0) {
        runningEvents[msg.chat.id].events.forEach((element, index) => {
            eventString = eventString + '\n' + element.message;
            element.times.forEach((tElement, tIndex) => {
                var timeSegment = '';
                if (tElement.hour === 0) {
                    tElement.hour = 12
                    timeSegment = 'a.m.';
                } else if (tElement.hour > 12) {
                    tElement.hour = tElement.hour - 12;
                    timeSegment = 'p.m.';
                }
                if (tElement.minute === 0) {
                    tElement.minute = tElement.minute + '0';
                } else if (tElement.minute > 0 && tElement.minute < 10) {
                    tElement.minute = '0' + tElement.minute;
                }
                if (index === 0) {
                    eventString = eventString + ' - ' + tElement.hour + ':' + tElement.minute + ' ' + timeSegment;
                } else {
                    eventString = eventString + ' - ' + tElement.hour + ':' + tElement.minute + ' ' + timeSegment;
                }
            });
        });
    } else {
        eventString = `No events running. Use "/addevent [time] [name] to make one!"`;
    }
    bot.sendMessage(msg.chat.id, eventString);
});

bot.onText(/^\/time/, (msg, match) => {
    var time = new Date();
    bot.sendMessage(msg.chat.id, 'Server time: ' + time.toTimeString());
});

bot.onText(/^\/cowsay (.+)$/, (msg, match) => {
    bot.sendMessage(msg.chat.id, cowsay.say({
        text: match[1]
    }));
});

bot.onText(/(remind me in a bit to)([\w\s]+)./i, (msg, match) => {
    var time = new Date(new Date().getTime() + 1 * 60000);
    console.log(time);
    var reminder = new cronJob(
        time,
        () => {
            bot.sendMessage(msg.chat.id, `Hey ${msg.chat.first_name}, go and ${match[2]}`);
        },
        () => {
        },
        true,
        'America/New_York');
    console.log('something to happen after cron');
    bot.sendMessage(msg.chat.id, `I'll remind you to ${match[2]} in a bit`);
});