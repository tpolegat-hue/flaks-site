# Як додавати статті на сайт FLAKS

1. Скопіюйте файл `template.html`.
2. Перейменуйте копію латиницею, наприклад `rezhymy-rizannia-dlia-sverdel.html`.
3. Змініть у файлі:
   - `<title>`
   - `meta description`
   - `canonical`
   - `og:title`
   - `og:description`
   - `h1`
   - текст статті
   - JSON-LD `headline`, `datePublished`, `dateModified`, `description`
4. Додайте посилання на нову статтю в `articles/index.html`.
5. Додайте URL у `build-seo.mjs` до масиву додаткових сторінок або вручну в `sitemap.xml`.

Для Google важливо, щоб стаття була корисною для технолога, закупівельника або майстра: конкретна задача, пояснення,
приклади, терміни, помилки при підборі, рекомендації FLAKS і контакт для уточнення.
