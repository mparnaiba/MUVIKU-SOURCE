import { Source, Manga, MangaStatus, Chapter, ChapterDetails, HomeSectionRequest, HomeSection, MangaTile, SearchRequest, LanguageCode, TagSection, Request, MangaUpdates, SourceTag, TagType } from "paperback-extensions-common"
const LH_DOMAIN = 'https://unionmangas.top/ayx'

const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
// Regular expression to check formal correctness of base64 encoded strings
const b64re = /^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/;

const _atob = (string: string) => {
  // atob can work with strings with whitespaces, even inside the encoded part,
  // but only \t, \n, \f, \r and ' ', which can be stripped.
  string = String(string).replace(/[\t\n\f\r ]+/g, "");

  if (!b64re.test(string))
    throw new TypeError("Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.");

  // Adding the padding if missing, for semplicity
  string += "==".slice(2 - (string.length & 3));
  var bitmap, result = "", r1, r2, i = 0;
  for (; i < string.length;) {
    bitmap = b64.indexOf(string.charAt(i++)) << 18 | b64.indexOf(string.charAt(i++)) << 12
      | (r1 = b64.indexOf(string.charAt(i++))) << 6 | (r2 = b64.indexOf(string.charAt(i++)));

    result += r1 === 64 ? String.fromCharCode(bitmap >> 16 & 255)
      : r2 === 64 ? String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255)
        : String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255, bitmap & 255);
  }
  return result;
};

declare var window: Window;

const atob_polyfilled = (b64: string) => {
  // let _window = window
  if (typeof window !== 'undefined' && window?.atob !== undefined) {
    return window.atob(b64)
  }
  return _atob(b64)
}

export class UnionMangas extends Source {
  constructor(cheerio: CheerioAPI) {
    super(cheerio)
  }

  get version(): string { return '0.2.3' }
  get name(): string { return 'UnionMangas' }
  get description(): string { return 'Extension that pulls manga from UnionMangas. Thumbnails are currently broken.' }
  get author(): string { return 'Matheus Parnaíba' }
  get authorWebsite(): string { return 'http://github.com/chyyran' }
  get icon(): string { return "logo.png" }
  get hentaiSource(): boolean { return false }
  getMangaShareUrl(mangaId: string): string | null { return `${LH_DOMAIN}/${mangaId}.html` }
  get sourceTags(): SourceTag[] { return [{ text: "raw", type: TagType.INFO }] }



  getMangaDetailsRequest(ids: string[]): Request[] {
    let requests: Request[] = []
    for (let id of ids) {
      let metadata = { 'id': id }
      requests.push(createRequestObject({
        url: `${LH_DOMAIN}/${id}.html`,
        metadata: metadata,
        method: 'GET'
      }))
    }
    return requests
  }

  getMangaDetails(data: any, metadata: any): Manga[] {
    let $ = this.cheerio.load(data)

    let titles: string[] = []
    let author

    let tags: TagSection[] = [createTagSection({ id: '0', label: 'genre', tags: [] })]
    let status: MangaStatus = MangaStatus.ONGOING   // Default to ongoing
    let views
    let lang = LanguageCode.JAPANESE

    let breadcrumbContext = $('li', $('.breadcrumb')).toArray()?.[2];
    let title = $('span', breadcrumbContext).text()
      .replace("- Raw", "").trim() ?? ''
    titles.push(title)
    let image = $('img', breadcrumbContext).attr('src')
    let objContext = $('li', $('.manga-info')).toArray()

    for (let i = 0; i < objContext.length; i++) {
      switch (i) {
        case 1: {
          titles.push($(objContext[i]).text().replace("Other names: ", "").trim()) ?? ''
          break;
        }
        case 2: {
          author = $('a', $(objContext[i])).text() ?? ''
          break;
        }
        case 3: {
          for (let obj of $('a', $(objContext[i]).toArray()).toArray()) {
            let text = $(obj).text()
            tags[0].tags.push(createTag({ label: text, id: text }))
          }
          break;
        }
        case 4: {
          let text = $('a', $(objContext[i])).text()
          status = text.includes("On Going") ? MangaStatus.ONGOING : MangaStatus.COMPLETED
          break;
        }
        case 6: {
          views = $(objContext[i]).text().replace(" Views: ", "") ?? ''
          break;
        }
      }
    }

    let rowContext = $('.row', $('.well-sm')).toArray()
    let description = $('p', $(rowContext[1])).text()

    let rating = $('.h0_ratings_active', $('.h0rating')).toArray().length

    return [createManga({
      id: metadata.id,
      titles: titles,
      image: image!,
      status: status,
      desc: description,
      tags: tags,
      author: author,
      rating: rating,
      langFlag: lang,
      langName: lang,
      views: views ? Number.parseInt(views, 10) : undefined,
      hentai: false,
    })]

  }

  getChaptersRequest(mangaId: string): Request {
    let metadata = { 'id': mangaId }
    mangaId = mangaId.replace(".html", "")
    return createRequestObject({
      url: `${LH_DOMAIN}/${mangaId}.html`,
      metadata: metadata,
      method: 'GET'
    })
  }

  getChapters(data: any, metadata: any): Chapter[] {
    let $ = this.cheerio.load(data)
    let chapters: Chapter[] = []

    let lang

    let objContext = $('li', $('.manga-info')).toArray()
    for (let i = 0; i < objContext.length; i++) {
      switch (i) {
        case 3: {
          for (let obj of $('a', $(objContext[i]).toArray()).toArray()) {
            let text = $(obj).text()

            if (text.toLowerCase().includes("raw")) {
              lang = LanguageCode.JAPANESE
            }
            else {
              lang = LanguageCode.ENGLISH
            }
          }
          break;
        }
      }
    }

    for (let obj of $('tr', $('.table')).toArray().reverse()) {
      let id = $('.chapter', $(obj)).attr('href')
      let name = $('b', $(obj)).text().trim()

      //TODO Add the date calculation into here
      let timeStr = /(\d+) ([hours|weeks|months]+) ago/.exec($('time', $(obj)).text().trim())
      let date = new Date()
      if (timeStr) {

        switch (timeStr[2]) {
          case 'hours': {
            // Do nothing, we'll just call it today
            break;
          }
          case 'weeks': {
            date.setDate(date.getDate() - (Number(timeStr[1])) * 7)
            break;
          }
          case 'months': {
            date.setDate(date.getDate() - (Number(timeStr[1])) * 31)  // We're just going to assume 31 days each month I guess. Can't be too specific 
            break;
          }
        }
      }

      chapters.push(createChapter({
        id: id!,
        mangaId: metadata.id,
        chapNum: Number.parseFloat(name?.match(/(?:- Raw Chapter )([\d\.]+$)/)?.[1] ?? "0"),
        langCode: lang ?? LanguageCode.UNKNOWN,
        name: name,
        time: date
      }))
    }

    return chapters
  }

  getChapterDetailsRequest(mangaId: string, chapId: string): Request {

    let metadata = { 'mangaId': mangaId, 'chapterId': chapId }
    return createRequestObject({
      url: `${LH_DOMAIN}/${chapId}.html`,
      metadata: metadata,
      method: 'GET',
    })
  }

  getChapterDetails(data: any, metadata: any): ChapterDetails {
    let $ = this.cheerio.load(data)
    let pages: string[] = []

    for (let obj of $('img.chapter-img', $('.chapter-content')).toArray()) {
      let srcBase64 = $(obj).attr('data-src')
      if (srcBase64?.startsWith("http")) {
        pages.push(srcBase64!.trim())
      } else {
        pages.push(atob_polyfilled(srcBase64!.replace('PGJyIC8+', "")).trim()) // "PGJyIC8+" = btoa('<br />')
      }
    }

    metadata.chapterId = metadata.chapterId.replace(".html", "")
    metadata.chapterId = metadata.chapterId.replace(/-chapter-\d/g, "")
    metadata.chapterId = metadata.chapterId.replace("read", "manga")

    return createChapterDetails({
      id: metadata.chapterId,
      mangaId: metadata.mangaId,
      pages: pages,
      longStrip: true
    })
  }


  searchRequest(query: SearchRequest, page: number): Request | null {

    let title = query.title?.replace(" ", "+")

    return createRequestObject({
      url: `${LH_DOMAIN}/danh-sach-truyen.html?m_status=&author=&group=&name=${title}&genre=&ungenre=`,
      timeout: 4000,
      method: "GET"
    })
  }

  search(data: any, metadata: any): MangaTile[] {

    let $ = this.cheerio.load(data)
    let mangaTiles: MangaTile[] = []

    for (let obj of $('.row-list').toArray()) {
      let title = $('a', $('.media-heading', $(obj))).text().replace('- Raw', '') ?? ''
      let id = $('a', $('.media-heading', $(obj))).attr('href') ?? ''
      let img = $('img', $(obj)).attr('src') ?? ''
      let textContext = $('.media-body', $(obj))
      let primaryText = createIconText({ text: $('span', textContext).text() })

      id = id.replace(".html", "")

      mangaTiles.push(createMangaTile({
        title: createIconText({ text: title }),
        id: id,
        image: img,
        primaryText: primaryText
      }))
    }

    return mangaTiles
  }

  getHomePageSectionRequest(): HomeSectionRequest[] {
    let request = createRequestObject({ url: `${LH_DOMAIN}`, method: 'GET' })
    let section1 = createHomeSection({ id: 'latest_release', title: 'Latest Manga Releases' })

    return [createHomeSectionRequest({ request: request, sections: [section1] })]
  }

  getHomePageSections(data: any, sections: HomeSection[]): HomeSection[] {
    let $ = this.cheerio.load(data)
    let latestManga: MangaTile[] = []

    let context = $('#contentstory')?.toArray()?.[0]
    for (let item of $('.itemupdate', $(context)).toArray()) {
      let id = $('a', $(item)).attr('href')?.replace(".html", "")
      let titleText = $('.title-h3', $(item))?.text()
        ?.replace('- Raw', '')
        ?.replace('- RAW', '')
        ?.replace('(Manga)', '')?.trim()

      if (!id || !titleText) {
        continue;
      }
      let title = createIconText({
        text: titleText
      })

      let image = $('.myimg', $(item))?.attr('data-src') ?? ''
      let views = $('.view', $(item))?.text() ?? 0

      latestManga.push(createMangaTile({
        id: id,
        title: title,
        image: image,
        primaryText: createIconText({ text: views })
      }))
    }

    sections[0].items = latestManga

    return sections
  }
  requestModifier(request: Request): Request {

    let headers: any = request.headers == undefined ? {} : request.headers
    headers['Referer'] = `${LH_DOMAIN}`

    return createRequestObject({
      url: request.url,
      method: request.method,
      headers: headers,
      data: request.data,
      metadata: request.metadata,
      timeout: request.timeout,
      param: request.param,
      cookies: request.cookies,
      incognito: request.incognito
    })
  }
}