'use strict';

const xml2js = require('xml2js')
const getStdin = require('get-stdin')

class Harvest {

    constructor (data, config) {
	this.data = data;
	this.config = config;
	this.parser = new xml2js.Parser({
	    trim: true,
	    explicitArray: false,
	    explicitRoot: false,
	    mergeAttrs: true
	})
    }


    harvestObjects () {

	return new Promise((resolve, reject) => {
	    this.parser.parseString(this.data, (err, tmsxmljson) => {
		if (err) console.error(err)
		this._tmsxmljson2cleanjson(tmsxmljson, (err, cleanjson) => {
		    if (err) {
			reject(err)
		    } else {
			resolve(JSON.stringify(cleanjson))
		    }
		})
	    })	    
	});
    }

    _tmsxmljson2cleanjson (tmsxmljson, callback) {

	const parseText = text => ({text: text._, lang: text.lang})

	const parseObjectOrArray = (obj, fn) => {
	    if (obj === null) return null
	    if (Array.isArray(obj)) return obj.map(fn)
	    if (typeof obj === 'object') return Object.values(obj).map(fn)
	}
	
	const parseAreaCategory = areacategory => ({
	    rank: parseInt(areacategory.rank),
	    type: areacategory.type,
	    areacat: areacategory.areacat ? areacategory.areacat.map(parseText) : null
	})
	
	const parseMedia = media => ({
	    rank: parseInt(media.rank),
	    primarydisplay: parseInt(media.primarydisplay),
	    filename: media.filename
	})
	
	const parseAuthors = authors => {
	    return parseObjectOrArray(authors, parseAuthor)
	}
	
	const parseAuthor = author => ({
	    rank: parseInt(author.rank),
	    author: parseInt(author.author),
	    authornameid: parseInt(author.authornameid),
	    nationality: author.nationality,
	    name: author.name,
	    birthyear_yearformed: parseInt(author.birthyear_yearformed),
	    deathyear: parseInt(author.deathyear),
	    roles: parseObjectOrArray(author.roles, parseText)
	})
	
	const parseDate = date => new Date(date)
	
	const parseVenues = venues => parseObjectOrArray(venues, parseVenue)
	
	const parseVenue = venue => ({
	    begindate: parseDate(venue.begindate),
	    enddate: parseDate(venue.enddate),
	    name: parseObjectOrArray(venue.name, parseText)
	})
	
	const parseExhibition = exhibition => ({
	    begindate: parseDate(exhibition.begindate),
	    enddate: parseDate(exhibition.enddate),
	    title: exhibition.title ? parseText(exhibition.title.title) : null,
	    venues: parseObjectOrArray(exhibition.venues, parseVenues)
	})
	
	return new Promise((resolve, reject) => {

	    const cleanjson = tmsxmljson.objects.object.map(o => ({
	        id: parseInt(o.id),
	        objectnumber: parseFloat(o.objectnumber),
	        datebegin: parseFloat(o.datebegin),
	        dateend: parseFloat(o.dateend),
	        objectstatus: parseObjectOrArray(o.objectstatus.objectstatus, parseText),
	        creditlines: parseObjectOrArray(o.creditlines, parseText),
	        mediums: parseObjectOrArray(o.mediums, parseText),
	        dimensions: parseObjectOrArray(o.dimensions, parseText),
	        areacategories: parseObjectOrArray(o.areacategories.areacategory, parseAreaCategory),
	        authors: parseObjectOrArray(o.authors, parseAuthors)[0],
	        medias: parseObjectOrArray(o.medias, parseMedia),
	        titles: parseObjectOrArray(o.titles, parseText),
	        dated: o.dated,
	        exhibitions: parseObjectOrArray(o.exhibitions, parseExhibition),
	        copyrightcreditlines: parseObjectOrArray(o.copyrightcreditlines, parseText),
	        summaries: parseObjectOrArray(o.summaries, parseText)
	    }))
	    
	    callback(null, cleanjson)
	    
	});

    }
        
}

module.exports = Harvest;
