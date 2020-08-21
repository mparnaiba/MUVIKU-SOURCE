import cheerio from 'cheerio'
import { HanaScan } from "../HanaScan/HanaScan";
import { APIWrapper, Source } from 'paperback-extensions-common';

describe('HanaScan Tests', function () {

    var wrapper: APIWrapper = new APIWrapper();
    var source: Source = new HanaScan(cheerio);
    var chai = require('chai'), expect = chai.expect, should = chai.should();
    var chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);

    /**
     * The Manga ID which this unit test uses to base it's details off of.
     * Try to choose a manga which is updated frequently, so that the historical checking test can 
     * return proper results, as it is limited to searching 30 days back due to extremely long processing times otherwise.
     */
    var mangaId = "manga-nihon-e-youkoso-elf-san-raw";

    it("Retrieve Manga Details", async () => {
        let details = await wrapper.getMangaDetails(source, [mangaId]);
        expect(details, "No results found with test-defined ID [" + mangaId + "]").to.be.an('array');
        expect(details).to.not.have.lengthOf(0, "Empty response from server");

        // Validate that the fields are filled
        let data = details[0];
        expect(data.id, "Missing ID").to.be.not.empty;
        expect(data.image, "Missing Image").to.be.not.empty;
        expect(data.status, "Missing Status").to.exist;
        expect(data.author, "Missing Author").to.be.not.empty;
        expect(data.desc, "Missing Description").to.be.not.empty;
        expect(data.titles, "Missing Titles").to.be.not.empty;
        expect(data.rating, "Missing Rating").to.exist;
    });

    it("Get Chapters", async () => {
        let data = await wrapper.getChapters(source, mangaId);

        expect(data, "No chapters present for: [" + mangaId + "]").to.not.be.empty;
    });

    it("Get Chapter Details", async () => {

        let chapters = await wrapper.getChapters(source, mangaId);
        let data = await wrapper.getChapterDetails(source, mangaId, chapters[0].id);

        expect(data, "No server response").to.exist;
        expect(data, "Empty server response").to.not.be.empty;

        expect(data.id, "Missing ID").to.be.not.empty;
        expect(data.mangaId, "Missing MangaID").to.be.not.empty;
        expect(data.pages, "No pages present").to.be.not.empty;
    });

    it("Testing search", async () => {
        let testSearch = createSearchRequest({
            title: 'NIHON E YOUKOSO ELF-SAN'
        });

        let search = await wrapper.search(source, testSearch, 1);
        let result = search[0];

        expect(result, "No response from server").to.exist;

        expect(result.id, "No ID found for search query").to.be.not.empty;
        expect(result.image, "No image found for search").to.be.not.empty;
        expect(result.title, "No title").to.be.not.null;
        expect(result.subtitleText, "No subtitle text").to.be.not.null;
    });

    it("Testing invalid search", async () => {
        let testSearch = createSearchRequest({
            title: 'this_search_definitely_is_not_valid_asdklfhjawelorghawlehdsf'
        });

        let search = await wrapper.search(source, testSearch, 1);
        let result = search[0];

        expect(result, "No response from server").to.not.exist;
    });

    it("Retrieve Home Page Sections", async () => {

        let data = await wrapper.getHomePageSections(source);
        expect(data, "No response from server").to.exist;
        expect(data, "No response from server").to.be.not.empty;

        // Do some MangaPark specific validation for this server response
        let latest = data[0];
        expect(latest.id, "Latest Manga ID does not exist").to.not.be.empty;
        expect(latest.title, "Latest Manga section does not exist").to.not.be.empty;
        expect(latest.items, "No items available for Latest Manga").to.not.be.empty;
        expect(latest.items[0].image, "No image available for Hot manga").to.not.be.empty;

        // Do some MangaPark specific validation for this server response
        let hot = data[1];
        expect(hot.id, "Hot Manga ID does not exist").to.not.be.empty;
        expect(hot.title, "Hot Manga section does not exist").to.not.be.empty;
        expect(hot.items, "No items available for Hot Manga").to.not.be.empty;
        expect(hot.items[0].image, "No image available for Hot manga").to.not.be.empty;
    });
})