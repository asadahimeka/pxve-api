import { assertEquals, assertExists } from '@std/assert'
import { load } from 'cheerio'

const mockPixivisionHtml = `
<html>
<body>
  <div class="main-column-container">
    <div class="_article-card">
      <div class="arc__title">
        <a data-gtm-label="123">Test Article</a>
      </div>
      <div class="_thumbnail" style="background-image: url(https://example.com/thumb.jpg)"></div>
      <div class="tls__list-item-container">
        <a href="/tags/1">tag1</a>
      </div>
    </div>
  </div>
  <div class="alc__articles-list-group--ranking">
    <div class="_article-summary-card">
      <a class="asc__title-link" data-gtm-label="rank1">Rank Article</a>
      <div class="_thumbnail" style="background-image: url(https://example.com/rank.jpg)"></div>
    </div>
  </div>
</body>
</html>
`

Deno.test('pixivision service - fetchPixivisionList parses articles correctly', () => {
  const $ = load(mockPixivisionHtml)
  const $articles = $('.main-column-container ._article-card')

  const articles = $articles.map(function () {
    const $this = $(this)
    const $link = $this.find('.arc__title a')
    return {
      id: $link.data('gtm-label'),
      title: $link.text(),
    }
  }).toArray()

  assertEquals(articles.length, 1)
  assertEquals(articles[0].id, 123)
  assertEquals(articles[0].title, 'Test Article')
})

Deno.test('pixivision service - fetchPixivisionList parses ranking items', () => {
  const $ = load(mockPixivisionHtml)
  const $rankList = $('.alc__articles-list-group--ranking ._article-summary-card')

  const rank = $rankList.map(function () {
    const $this = $(this)
    const $link = $this.find('.asc__title-link')
    return {
      id: $link.data('gtm-label'),
      title: $link.text(),
    }
  }).toArray()

  assertEquals(rank.length, 1)
  assertEquals(rank[0].id, 'rank1')
  assertEquals(rank[0].title, 'Rank Article')
})

Deno.test('pixivision service - thumbnail extraction works', () => {
  const $ = load(mockPixivisionHtml)
  const $thumbnail = $('.main-column-container ._article-card ._thumbnail').first()

  const thumbnail = $thumbnail.css('background-image')?.match(/url\((.*)\)/)?.[1]

  assertEquals(thumbnail, 'https://example.com/thumb.jpg')
})
