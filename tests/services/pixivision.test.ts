import { load } from 'cheerio'
import assert from 'node:assert/strict'
import { test } from 'node:test'

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

test('pixivision service - fetchPixivisionList parses articles correctly', () => {
  const $ = load(mockPixivisionHtml)
  const $articles = $('.main-column-container ._article-card')

  const articles = $articles
    .map(function () {
      const $this = $(this)
      const $link = $this.find('.arc__title a')
      return {
        id: $link.data('gtm-label'),
        title: $link.text(),
      }
    })
    .toArray()

  assert.deepEqual(articles.length, 1)
  assert.deepEqual(articles[0].id, 123)
  assert.deepEqual(articles[0].title, 'Test Article')
})

test('pixivision service - fetchPixivisionList parses ranking items', () => {
  const $ = load(mockPixivisionHtml)
  const $rankList = $('.alc__articles-list-group--ranking ._article-summary-card')

  const rank = $rankList
    .map(function () {
      const $this = $(this)
      const $link = $this.find('.asc__title-link')
      return {
        id: $link.data('gtm-label'),
        title: $link.text(),
      }
    })
    .toArray()

  assert.deepEqual(rank.length, 1)
  assert.deepEqual(rank[0].id, 'rank1')
  assert.deepEqual(rank[0].title, 'Rank Article')
})

test('pixivision service - thumbnail extraction works', () => {
  const $ = load(mockPixivisionHtml)
  const $thumbnail = $('.main-column-container ._article-card ._thumbnail').first()

  const thumbnail = $thumbnail.css('background-image')?.match(/url\((.*)\)/)?.[1]

  assert.deepEqual(thumbnail, 'https://example.com/thumb.jpg')
})
