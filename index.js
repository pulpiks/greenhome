const express = require('express');
const app = express();
const axios = require('axios');

const {
    HACKER_URL,
    MAX_COUNT,
    WEEK_TIMESTAMP,
    MAX_FREQUENT_WORDS,
    MIN_KARMA,
    COUNT_TITLES
} = require('./constants');

const getStoryTitle = async (id) => {
    return axios.get(`${HACKER_URL}item/${id}.json`)
        .then(res => {
            const data = res.data;
            if (data.type === 'story') {
                return data.title;
            }
            else {
                return '';
            }
        })
        .catch((e) => {
            throw new Error(e);
        });
};

const getMaxItemId = async () => {
    return axios.get(`${HACKER_URL}maxitem.json?print=pretty`)
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
    return axios.get(`${HACKER_URL}item/${id}.json`)
        .then(res => {
            return res.data;
        })
        .catch((e) => {
            throw new Error(e);
        });
};

const getStory = async (id) => {
    return axios.get(`${HACKER_URL}item/${id}.json`)
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
    return axios.get(`${HACKER_URL}user/${userId}.json`)
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

    const wordsArr = Object.keys(wordCounts);
    const limit = wordsArr.length - MAX_FREQUENT_WORDS >=0 ? MAX_FREQUENT_WORDS : wordsArr.length;
    let resMas = [];
    let indexes = [];
    for(let i =0; i < limit; i++) {
        let key = null;
        let max = 0;
        let index;
        wordsArr.forEach((word, j) => {
            if (wordCounts[word] >= max && indexes.indexOf(j) < 0 ) {
                max = wordCounts[word];
                key = word;
                index = j;
            }
        });
        resMas.push(key);
        indexes.push(index);
    }

    return resMas;
};



app.get('/newstories', async (req, response) => {
    try {
        let titles = [];
        const res = await axios.get(HACKER_URL+'newstories.json?print=pretty');
        const ids = res.data;
        titles = await Promise.all(ids.map((id) => getStoryTitle(id)));

        let lastId = res.data[res.data.length - 1] - 1;
        while ((titles.length < MAX_COUNT) && (lastId > 0)) {
            try {
                const title = await getStoryTitle(lastId);
                if (title && title.trim()) {
                    titles.push(title);
                }
            } catch (err) {
                //
            }
            lastId--;
        }
        console.log('titles.length = ', titles.length);
        // most frequent words
        const resMas = findFrequentWords(titles);

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
    let timeWeekAgo = curTime - WEEK_TIMESTAMP;
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
        const res = await axios.get(HACKER_URL+'newstories.json?print=pretty');
        const ids = res.data;
        console.log('----');
        const items = await Promise.all(ids.map((id) => getItem(id)));
        let itemId = res.data[res.data.length - 1] - 1;

        while ( titles.length < COUNT_TITLES && itemId > 0) {
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