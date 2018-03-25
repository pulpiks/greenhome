const express = require('express');
const app = express();
const axios = require('axios');
const haskerUrl = 'https://hacker-news.firebaseio.com/v0/';
const MAX_COUNT = 505;
const WEEK_TIMESTAMP = 7*24*60*60*1000;
const MINS_1_TIMESTAMP = 2*60*1000;
const MAX_FREQUENT_WORDS = 10;
const MIN_KARMA = 1;
const COUNT_TITLES_LAST = 50;

const getStoryTitle = async (id) => {
    return axios.get(`${haskerUrl}item/${id}.json`)
        .then(res => {
            const data = res.data;
            if (data.type === 'story') {
                return data.title;
            }
            else {
                throw new Error('not a story');
            }
        })
        .catch((e) => {
            throw new Error(e);
        });
};

const getMaxItemId = async () => {
    return axios.get(`${haskerUrl}maxitem.json?print=pretty`)
        .then(res => {
            if (typeof(+res.data)==='number') {
                return res.data;
            }
            else {
                throw new Error('incorrect answer');
            }
        })
        .catch((e)=> {
            throw new Error('smth went wrong');
        })
};

const getItem = async (id) => {
    return axios.get(`${haskerUrl}item/${id}.json`)
        .then(res => {
            return res.data;
        })
        .catch((e) => {
            throw new Error(e);
        });
};

const getStory = async (id) => {
    return axios.get(`${haskerUrl}item/${id}.json`)
        .then(res => {
            const data = res.data;
            if (data.type === 'story') {
                return data;
            }
            else {
                throw new Error('not a story');
            }
        })
        .catch((e) => {
            throw new Error(e);
        });
};

const getUser = async (userId) => {
    return axios.get(`${haskerUrl}user/${userId}.json`)
        .then(res => res.data)
        .catch((e) => {
            throw new Error(e);
        });
}


const findFrequentWords = (titles) => {
    var wordCounts = {};
    titles.forEach((title) => {
        console.log('title', title);
        let words = title.toLowerCase().split(/[^a-zA-Z_\-']+/);
        for(var i = 0; i < words.length; i++){
            if (words[i]!=='') {
                wordCounts[words[i]] = (wordCounts[words[i]] || 0) + 1;
            }
        }

    });
    console.log('wordsCount = ', wordCounts);
    const mostFrequentWords = Object.keys(wordCounts).sort((word1, word2) => {
        return wordCounts[word2] - wordCounts[word1];
    });
    console.log('mostFrequentWords', mostFrequentWords);
    const maxCount = (mostFrequentWords.length > 0) ? wordCounts[mostFrequentWords[0]] : null;
    console.log('maxCount = ', maxCount);
    let resMas = [];
    if (maxCount) {
        resMas = mostFrequentWords.reduce((words, word, index) => {
            if (words.length < MAX_FREQUENT_WORDS) {
                words.push(word);
            }
            return words;
        }, []);
    }

    return resMas;
};



app.get('/newstories', async (req, response) => {
    try {
        let titles = [];
        const res = await axios.get(haskerUrl+'newstories.json?print=pretty');
        const ids = res.data;
        console.log('----');
        titles = await Promise.all(ids.map((id) => getStoryTitle(id)));

        let lastId = res.data[res.data.length - 1] - 1;
        console.log('----');
        while ((titles.length < MAX_COUNT) && (lastId > 0)) {
            try {
                console.log(titles.length);
                const title = await getStoryTitle(lastId);
                console.log(title);
                titles.push(title);
            } catch (err) {
                //
            }
            lastId--;
        }
        console.log('titles.length = ', titles.length);
        // most frequent words
        const resMas = findFrequentWords(titles);

        console.log(resMas);
        response.send(resMas);
    }
    catch (err) {
        console.log(error);
    }
});


/*
* Top 10 most occurring words in the titles of exactly the last week
* */

app.get('/getfeedforlastweek', async (req, res) => {
    console.log('req', req.query.time);
    let curTime = Date.now();
    let timeWeekAgo = curTime - MINS_1_TIMESTAMP;
    let itemTime = curTime;
    try {
        let itemId = await getMaxItemId();
        console.log(itemId);
        let titles = [];
        while (( itemTime >= timeWeekAgo) && (itemId > 0)) {
            try {
                console.log(titles.length, itemTime, timeWeekAgo);
                const story = await getItem(itemId);
                itemTime = story.time*1000;
                if (!!story.title && itemTime >= timeWeekAgo) {
                    let { title } = story;
                    console.log('story======', title);
                    titles.push(story.title);
                }
            } catch (err) {
                //
            }
            console.log(itemId);
            itemId--;
        }

        const resMas = findFrequentWords(titles);

        console.log('resMas', resMas);

        res.send(resMas);
    }
    catch(e) {
        throw new Error(e);
    }

});

/*
* Top 10 most occurring words in titles of the last 60 stories of users with at least 10.000 karma
* */

app.get('/getuserfeed', async (req, response) => {
    try {
        let titles = [];
        const res = await axios.get(haskerUrl+'newstories.json?print=pretty');
        const ids = res.data;
        console.log('----');
        const items = await Promise.all(ids.map((id) => getItem(id)));
        let itemId = res.data[res.data.length - 1] - 1;

        while ( titles.length < COUNT_TITLES_LAST && itemId > 0) {
            try {
                let curItem;
                if (items.length > 0) {
                    curItem = items.shift();
                }
                else {
                    itemId--;
                    if (itemId) {
                        itemId = await getMaxItemId();
                    }
                    curItem = await getItem(itemId);
                }
                const { title, by } = curItem;

                if (typeof title !== 'undefined') {
                    let user = await getUser(by);
                    if (user.karma >= MIN_KARMA) {
                        titles.push(title);
                    }
                }


            } catch (err) {
                //
                throw new Error(err);
            }
        }

        const resMas = findFrequentWords(titles);
        console.log('resMas', resMas);
        response.send(resMas);
    }
    catch(e) {
        throw new Error(e);
    }
});

app.listen(3000);