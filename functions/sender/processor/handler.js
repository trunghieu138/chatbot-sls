'use strict';

const axios = require('axios');
const striptags = require('striptags');
const _ = require('lodash');
const fbGraphApi = process.env.FB_GRAPH_API;
const maxEvents = process.env.MAX_EVENTS;
const genericImg = process.env.GENERIC_IMAGE;
const xmasGenericImg = process.env.XMAS_GENERIC_IMAGE;
const genericUrl = process.env.GENERIC_URL;


const prepareFbPayload = (websiteUrl, fbPayload, allEvents, eventImgUrl) => {
  if (allEvents.length === 0) {
    fbPayload.message.text = 'Sorry, we cannot find any event';
  } else {
    delete fbPayload.message['text'];
    fbPayload.message.attachment = {
      type: 'template',
      payload: {
        template_type: 'generic'
      }
    };
    const max = (allEvents.length < maxEvents) ? allEvents.length : maxEvents;
    let allEventElements = [];
    for (let i = 0; i < max; i++) {
      let eventName = '';
      if (allEvents[i].name.en === undefined || allEvents[i].name.en === '') {
        eventName = allEvents[i].name.fi;
      } else {
        eventName = allEvents[i].name.en;
      }
      const infoUrl = websiteUrl + allEvents[i].id + '/fi';
      let imageUrl = eventImgUrl;
      if (allEvents[i].images.length > 0) {
        imageUrl = allEvents[i].images[0].url;
      }
      const singleEventElement = {
        title: eventName,
        image_url: imageUrl,
        subtitle: eventName,
        buttons: [
          {
            type: 'web_url',
            url: infoUrl,
            title: 'More details'
          }
        ]
      };
      allEventElements.push(singleEventElement);
    }
    console.info('all event elements:', JSON.stringify(allEventElements, null, 2));
    fbPayload.message.attachment.payload.elements = allEventElements;
  }
  return fbPayload;
};


module.exports.handler = (event, context, callback) => {
  console.info('invoke lambda function processor');
  console.info('event:', JSON.stringify(event, null, 2));
  let apiEndpoint;
  let websiteUrl;
  const eventImgUrl = (event.type !== 'christmas') ? genericImg : xmasGenericImg;
  if (event.city === 'helsinki') {
    apiEndpoint = process.env.HKI_LINKEDEVENT_API;
    websiteUrl = process.env.HKI_WEBSITE_URL;
  } else if (event.city === 'turku') {
    apiEndpoint = process.env.TKU_LINKEDEVENT_API;
    websiteUrl = process.env.TKU_WEBSITE_URL;
  } else {
    apiEndpoint = process.env.ESPOO_LINKEDEVENT_API;
    websiteUrl = process.env.ESPOO_WEBSITE_URL;
  }
  let queryApi = `${apiEndpoint}q=${event.type}&start=${event.time}`;
  if (event.endtime !== undefined) {
    queryApi += `&end=${event.endtime}`;
  }
  let fbPayload = event.payload;
  console.info(`query api: ${queryApi}`);
  axios.get(queryApi)
    .then(response => {
      const allEvents = response.data.data;
      if (allEvents.length === 0) {
        fbPayload = prepareFbPayload(websiteUrl, fbPayload, allEvents);
      } else {
        let filteredEvents = [allEvents[0]];
        _.forEach(allEvents, item => {
          const sameEvents = _.find(filteredEvents, o => {
            return o.name.fi == item.name.fi;
          });
          if (sameEvents === undefined) {
            filteredEvents.push(item);
          }
        });
        fbPayload = prepareFbPayload(websiteUrl, fbPayload, filteredEvents, eventImgUrl);
      }
      console.info('FB payload:', JSON.stringify(fbPayload, null, 2));
      console.info(`FB api: ${fbGraphApi}`);
      return axios.post(fbGraphApi, fbPayload);
    })
    .then(response => {
      console.info('success:', JSON.stringify(response, null, 2));
      callback(null, response);
    })
    .catch(error => {
      console.error('failure:', JSON.stringify(error, null, 2));
      callback(error);
    });
};
