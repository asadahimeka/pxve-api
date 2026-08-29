import { load, type CheerioAPI, type Cheerio } from 'cheerio'
import { UA_HEADER } from '@lib/const.ts'
import { objectToQueryString } from './pixiv/pixiv-now.ts'

const languages = ['en', 'zh-tw', 'zh', 'ko', 'th', 'ms', 'ja']
const getLang = (lang: string) => languages.find(e => lang.toLowerCase().includes(e)) || 'en'

export async function fetchPixivisionList(query: Record<string, any>) {
  const { type = 'illustration', lang = 'zh', page } = query
  const params = page ? { p: page } : {}

  const config = {
    url: `https://www.pixivision.net/${getLang(lang)}/c/${type}`,
    method: 'GET',
    headers: {
      ...UA_HEADER,
    },
  }

  const htmlResp = await fetch(config.url + objectToQueryString(params), config)
  if (!htmlResp.ok) throw new Error(htmlResp.statusText)
  const data: any = {}
  const $ = load(await htmlResp.text())

  const $articles = $('.main-column-container ._article-card')
  data.articles = $articles
    .map(function () {
      const $this = $(this)
      const $link = $this.find('.arc__title a')
      return parseArticle($, $this, $link)
    })
    .toArray()

  if (!page) {
    const $rankList = $('.alc__articles-list-group--ranking ._article-summary-card')
    data.rank = $rankList
      .map(function () {
        return parseSideItem($(this))
      })
      .toArray()

    const $recList = $('._articles-list-card[data-gtm-category="Osusume Area"] ._article-summary-card')
    data.recommend = $recList
      .map(function () {
        return parseSideItem($(this))
      })
      .toArray()
  }

  return data
}

function parseArticle($: CheerioAPI, $this: Cheerio<any>, $link: Cheerio<any>) {
  return {
    id: $link.data('gtm-label'),
    title: $link.text(),
    pure_title: $link.text().split('-')[1] || '',
    thumbnail: $this
      .find('._thumbnail')
      .css('background-image')
      ?.match(/url\((.*)\)/)?.[1],
    article_url: `https://www.pixivision.net${$link.attr('href')}`,
    publish_date: $this.find('_date').attr('datetime'),
    tags: $this
      .find('.tls__list-item-container a')
      .map(function () {
        const $el = $(this)
        return {
          id: $el.attr('href')?.match(/(\d+)/)?.[1],
          name: $el.text(),
        }
      })
      .toArray(),
  }
}

function parseSideItem($this: Cheerio<any>) {
  const $link = $this.find('.asc__title-link')
  return {
    id: $link.data('gtm-label'),
    title: $link.text(),
    pure_title: $link.text().split('-')[1] || '',
    thumbnail: $this
      .find('._thumbnail')
      .css('background-image')
      ?.match(/url\((.*)\)/)?.[1],
    article_url: `https://www.pixivision.net${$link.attr('href')}`,
    publish_date: null,
    tags: [],
  }
}

export async function fetchPixivisionDetail(id: string, query: Record<string, any>) {
  const { lang = 'zh' } = query
  const config = {
    url: `https://www.pixivision.net/${getLang(lang)}/a/${id}`,
    method: 'GET',
    headers: {
      ...UA_HEADER,
    },
  }

  const htmlResp = await fetch(config.url, config)
  if (!htmlResp.ok) throw new Error(htmlResp.statusText)
  const data: any = {}
  const $ = load(await htmlResp.text())

  data.title = $('.am__title').text()
  data.cover = $('._article-illust-eyecatch img').attr('src')
  data.desc = $('._feature-article-body__article_thumbnail + ._feature-article-body__paragraph').text()

  data.items = $('.article-item._feature-article-body__pixiv_illust')
    .map(function () {
      const $this = $(this)
      const $titleLink = $this.find('.am__work__title a')
      const $userLink = $this.find('.am__work__user-name a')
      return {
        title: $titleLink.text(),
        illust_id: $titleLink.attr('href')?.match(/(\d+)/)?.[1],
        illust_url: $this.find('.am__work__illust').attr('src'),
        user_id: $userLink.attr('href')?.match(/(\d+)/)?.[1],
        user_name: $userLink.text(),
        user_avatar: $this.find('.am__work__uesr-icon').attr('src'),
      }
    })
    .toArray()

  data.tags = $('._tag-list a')
    .map(function () {
      const $el = $(this)
      return {
        id: $el.attr('href')?.match(/(\d+)/)?.[1],
        name: $el.text(),
      }
    })
    .toArray()

  const $latest = $('._related-articles[data-gtm-category="Related Article Latest"]')
  const $latest_tag_link = $latest.find('.rla__heading-link')
  data.related_latest = {
    tag_name: $latest_tag_link.data('gtm-label'),
    tag_id: $latest_tag_link.attr('href')?.match(/(\d+)/)?.[1],
    items: $latest
      .find('._article-summary-card-related')
      .map(function () {
        const $el = $(this)
        const $link = $el.find('.ascr__title-container > a')
        return {
          id: $link.attr('href')?.match(/(\d+)/)?.[1],
          title: $link.text(),
          thumbnail: $el
            .find('._thumbnail')
            .css('background-image')
            ?.match(/url\((.*)\)/)?.[1],
        }
      })
      .toArray(),
  }

  const $rec = $('._related-articles[data-gtm-category="Related Article Popular"]')
  const $rec_tag_link = $rec.find('.rla__heading-link')
  data.related_recommend = {
    tag_name: $rec_tag_link.data('gtm-label'),
    tag_id: $rec_tag_link.attr('href')?.match(/(\d+)/)?.[1],
    items: $rec
      .find('._article-summary-card-related')
      .map(function () {
        const $el = $(this)
        const $link = $el.find('.ascr__title-container > a')
        return {
          id: $link.attr('href')?.match(/(\d+)/)?.[1],
          title: $link.text(),
          thumbnail: $el
            .find('._thumbnail')
            .css('background-image')
            ?.match(/url\((.*)\)/)?.[1],
        }
      })
      .toArray(),
  }

  return data
}

export async function fetchPixivisionDetailContent(query: Record<string, any>) {
  const { id, lang = 'zh' } = query

  const config = {
    url: `https://www.pixivision.net/${getLang(lang)}/a/${id}`,
    method: 'GET',
    headers: {
      'accept-language': lang,
      ...UA_HEADER,
    },
  }

  const htmlResp = await fetch(config.url, config)
  if (!htmlResp.ok) throw new Error(htmlResp.statusText)
  const data: any = {}
  const $ = load(await htmlResp.text())

  $('a').removeAttr('target')

  data.title = $('.am__title').text()
  data.date = $('time._date').text()
  data.content = $('.am__body')
    .html()
    ?.replace(/www.pixiv.net\/\w+\/artworks/g, 'www.pixiv.net/artworks')
    ?.replace(/www.pixiv.net\/\w+\/users/g, 'www.pixiv.net/users')

  data.tags = $('._tag-list a')
    .map(function () {
      const $el = $(this)
      return {
        id: $el.attr('href')?.match(/(\d+)/)?.[1],
        name: $el.text(),
      }
    })
    .toArray()

  const $latest = $('._related-articles[data-gtm-category="Related Article Latest"]')
  const $latest_tag_link = $latest.find('.rla__heading-link')
  data.related_latest = {
    tag_name: $latest_tag_link.data('gtm-label'),
    tag_id: $latest_tag_link.attr('href')?.match(/(\d+)/)?.[1],
    items: $latest
      .find('._article-summary-card-related')
      .map(function () {
        const $el = $(this)
        const $link = $el.find('.ascr__title-container > a')
        return {
          id: $link.attr('href')?.match(/(\d+)/)?.[1],
          title: $link.text(),
          thumbnail: $el
            .find('._thumbnail')
            .css('background-image')
            ?.match(/url\((.*)\)/)?.[1],
        }
      })
      .toArray(),
  }

  const $rec = $('._related-articles[data-gtm-category="Related Article Popular"]')
  const $rec_tag_link = $rec.find('.rla__heading-link')
  data.related_recommend = {
    tag_name: $rec_tag_link.data('gtm-label'),
    tag_id: $rec_tag_link.attr('href')?.match(/(\d+)/)?.[1],
    items: $rec
      .find('._article-summary-card-related')
      .map(function () {
        const $el = $(this)
        const $link = $el.find('.ascr__title-container > a')
        return {
          id: $link.attr('href')?.match(/(\d+)/)?.[1],
          title: $link.text(),
          thumbnail: $el
            .find('._thumbnail')
            .css('background-image')
            ?.match(/url\((.*)\)/)?.[1],
        }
      })
      .toArray(),
  }

  return data
}
