param(
  [string]$ExcelPath = "G:\Cursor\Прайс_на_инструмент_из_наличия_x3.xlsx",
  [string]$OutDir = "."
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipText($zip, [string]$name) {
  $entry = $zip.GetEntry($name)
  if (-not $entry) { return $null }
  $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Load-Xml($text) {
  $xml = [xml]::new()
  $xml.PreserveWhitespace = $false
  $xml.LoadXml($text)
  return $xml
}

function Local-Name($nodeName) {
  if ($nodeName -like "*:*") { return ($nodeName -split ":", 2)[1] }
  return $nodeName
}

function Cell-Column([string]$ref) {
  return ([regex]::Match($ref, "^[A-Z]+")).Value
}

function To-Number($value) {
  if ($null -eq $value) { return $null }
  $s = [string]$value
  $s = $s.Trim().Replace(",", ".")
  $n = 0.0
  if ([double]::TryParse($s, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$n)) {
    return $n
  }
  return $null
}

function Normalize-Text([string]$text) {
  if ($null -eq $text) { return "" }
  # Collapse whitespace and replace the legacy backslash separator with a
  # forward slash (м\р -> м/р, к\х -> к/х, inch fractions 5\8 -> 5/8).
  return ((($text -replace "\s+", " ").Trim()) -replace "\\", "/")
}

function Convert-ToUa([string]$text) {
  $result = Normalize-Text $text
  $replacements = [ordered]@{
    "Метчики м/р метрические правые" = "Мітчики машинно-ручні метричні праві"
    "Метчики бесстружечные" = "Мітчики безстружкові"
    "Метчик бесстружечный" = "Мітчик безстружковий"
    "Метчики мр метрические правые" = "Мітчики машинно-ручні метричні праві"
    "Метчики м/р через шаг" = "Мітчики машинно-ручні через крок"
    "Метчики мр через шаг" = "Мітчики машинно-ручні через крок"
    "Метчики для трапецеидальной резьбы и другие" = "Мітчики для трапецеїдальної різьби та інші"
    "Метчики трапеция и др" = "Мітчики трапеція та інші"
    "Метчики гаечные" = "Мітчики гайкові"
    "Метчики ручные" = "Мітчики ручні"
    "Метчики левые" = "Мітчики ліві"
    "Метчики" = "Мітчики"
    "Метчик" = "Мітчик"
    "метчики" = "мітчики"
    "метчик" = "мітчик"
    "машинно-ручные" = "машинно-ручні"
    "гаечные" = "гайкові"
    "импортные" = "імпортні"
    "глухой" = "глухий"
    "сквозной" = "наскрізний"
    "комплект из" = "комплект із"
    "штук" = "штук"
    "с винтовой рабочей частью" = "з гвинтовою робочою частиною"
    "с толщенным хвостовиком" = "з потовщеним хвостовиком"
    "с утолщенным хвостовиком" = "з потовщеним хвостовиком"
    "по нержавейке" = "по нержавійці"
    "по наржавейке" = "по нержавійці"
    " и " = " та "
    "раскатники" = "розкатники"
    "раскатник" = "розкатник"
    "бесстружечные" = "безстружкові"
    "бесстружечный" = "безстружковий"
    "гаечный" = "гайковий"
    "ручные" = "ручні"
    "левые" = "ліві"
    "правые" = "праві"
    "метрические" = "метричні"
    "трапецеидальной резьбы" = "трапецеїдальної різьби"
    "Плашки" = "Плашки"
    "Плашка" = "Плашка"
    "Калибры" = "Калібри"
    "Калибр" = "Калібр"
    "Сверла к/х" = "Свердла к/х"
    "Сверла к\х" = "Свердла к\х"
    "Сверла ц/х" = "Свердла ц/х"
    "Сверла ц\х" = "Свердла ц\х"
    "Сверла центровочные" = "Свердла центрувальні"
    "Сверла твердосплавные" = "Свердла твердосплавні"
    "Сверла" = "Свердла"
    "сверла" = "свердла"
    "Сверло" = "Свердло"
    "сверло" = "свердло"
    "твердосплавные" = "твердосплавні"
    "твердосплавное" = "твердосплавне"
    "твердосплавная" = "твердосплавна"
    "центровочные" = "центрувальні"
    "центровочное" = "центрувальне"
    "средняя серия" = "середня серія"
    "длинная серия" = "довга серія"
    "средние" = "середні"
    "длинные" = "довгі"
    "Фрезы концевые" = "Фрези кінцеві"
    "Фрезы дисковые" = "Фрези дискові"
    "Фрезы червячные" = "Фрези черв'ячні"
    "Фрезы торцевые" = "Фрези торцеві"
    "Фрезы" = "Фрези"
    "фрезы" = "фрези"
    "Фреза" = "Фреза"
    "фреза" = "фреза"
    "концевые" = "кінцеві"
    "концевая" = "кінцева"
    "дисковая" = "дискова"
    "дисковые" = "дискові"
    "дисковое" = "дискове"
    "отрезные" = "відрізні"
    "отрезная" = "відрізна"
    "прорезные" = "прорізні"
    "прорезная" = "прорізна"
    "пазовые" = "пазові"
    "пазовая" = "пазова"
    "торцовые" = "торцеві"
    "торцовая" = "торцева"
    "червячные" = "черв'ячні"
    "червячная" = "черв'ячна"
    "долбяки" = "довбяки"
    "Развертки" = "Розгортки"
    "Развертка" = "Розгортка"
    "Зенкера" = "Зенкери"
    "Зенковки" = "Зенківки"
    "хвостовика" = "хвостовика"
    "хвостовик" = "хвостовик"
    "хвостовиком" = "хвостовиком"
    "с коническим хвостовиком" = "з конічним хвостовиком"
    "с цилиндрическим хвостовиком" = "з циліндричним хвостовиком"
    "круглый" = "круглий"
    "диаметр" = "діаметр"
    "общая длина" = "загальна довжина"
    "длина рабочей части" = "довжина робочої частини"
    "рабочей части" = "робочої частини"
    "рабочая часть" = "робоча частина"
    "рабочая" = "робоча"
    "часть" = "частина"
    "длина" = "довжина"
    "размеры" = "розміри"
    "другие" = "інші"
    "разные" = "різні"
    "комбинированное" = "комбіноване"
    "центровочным" = "центрувальним"
    "сверлом" = "свердлом"
    "цельная" = "суцільна"
    "цельный" = "суцільний"
    "монолитная" = "монолітна"
    "напайной" = "напаяною"
    "пластиной" = "пластиною"
    "пластина" = "пластина"
    "винтовая" = "гвинтова"
    "прямая" = "пряма"
    "ступицей" = "маточиною"
    "ступицы" = "маточини"
    "без ступицы" = "без маточини"
    "со ступицей" = "з маточиною"
    "сплав" = "сплав"
    "не указан" = "не вказано"
    "оригинальной упаковке" = "оригінальній упаковці"
    "упаковке" = "упаковці"
    "левая" = "ліва"
    "левый" = "лівий"
    "правая" = "права"
    "правый" = "правий"
    "ручной" = "ручний"
    "машинный" = "машинний"
    "гаечный" = "гайковий"
    "коническая" = "конічна"
    "конический" = "конічний"
    "цилиндрическая" = "циліндрична"
    "цилиндрический" = "циліндричний"
    "удлиненная" = "подовжена"
    "укороченная" = "укорочена"
    "мелкий шаг" = "дрібний крок"
    "крупный шаг" = "великий крок"
    "шаг" = "крок"
    "резьбы" = "різьби"
    "резьба" = "різьба"
    "сквозных" = "наскрізних"
    "глухих" = "глухих"
    "отверстий" = "отворів"
    "без" = "без"
    "для" = "для"
    "тип" = "тип"
    "серия" = "серія"
    "Китай" = "Китай"
    "Болгария" = "Болгарія"
    "Германия" = "Німеччина"
    "Япония" = "Японія"
    "Польша" = "Польща"
    "Чехия" = "Чехія"
    "Венгрия" = "Угорщина"
    "Цена" = "Ціна"
    "Кол-во" = "К-сть"
    "левое" = "ліве"
    "правое" = "праве"
    "с впаянной" = "з впаяною"
    "впаянной" = "впаяною"
    "стальной хвостовик" = "сталевий хвостовик"
    "наружным центром" = "зовнішнім центром"
    "оригинальная упаковка" = "оригінальна упаковка"
    "к-т из" = "к-т із"
    "Резцы" = "Різці"
    "резцы" = "різці"
    "Резец" = "Різець"
    "резец" = "різець"
    "зуборезн" = "зуборізн"
    "нарезания" = "нарізання"
    "нарезание" = "нарізання"
    "коннических" = "конічних"
    "конических" = "конічних"
    "конические" = "конічні"
    "коническое" = "конічне"
    "колес" = "коліс"
    "круговыми" = "круговими"
    "зубьями" = "зубами"
    "зубьев" = "зубів"
    "механическим креплением" = "механічним кріпленням"
    "механическим" = "механічним"
    "креплением" = "кріпленням"
    "крепление" = "кріплення"
    "крепежей" = "кріплення"
    "крепежом" = "кріпленням"
    "насадных" = "насадних"
    "насадные" = "насадні"
    "насадной" = "насадної"
    "разверток" = "розгорток"
    "зенкеров" = "зенкерів"
    " под посадку" = " під посадку"
    "пятигранн" = "п'ятигранн"
    "треугольник" = "трикутник"
    "ломанный" = "ломаний"
    "ломаная" = "ломана"
    "булатированный" = "булатований"
    "булатированная" = "булатована"
    "булатированные" = "булатовані"
  }

  foreach ($key in $replacements.Keys) {
    $result = $result.Replace($key, $replacements[$key])
  }
  return $result
}

function Get-CellValue($cell, $sharedStrings) {
  $type = $cell.t
  $vNode = $cell.ChildNodes | Where-Object { (Local-Name $_.Name) -eq "v" } | Select-Object -First 1
  $isNode = $cell.ChildNodes | Where-Object { (Local-Name $_.Name) -eq "is" } | Select-Object -First 1
  if ($isNode) {
    $texts = $isNode.GetElementsByTagName("t") | ForEach-Object { $_."#text" }
    return ($texts -join "")
  }
  if (-not $vNode) { return "" }
  $raw = $vNode.InnerText
  if ($type -eq "s") {
    $idx = [int]$raw
    if ($idx -ge 0 -and $idx -lt $sharedStrings.Count) { return $sharedStrings[$idx] }
  }
  return $raw
}

function Slugify([string]$text) {
  $normalized = (Normalize-Text $text).ToLowerInvariant()
  $map = @{
    "а"="a"; "б"="b"; "в"="v"; "г"="g"; "ґ"="g"; "д"="d"; "е"="e"; "ё"="e"; "є"="ye";
    "ж"="zh"; "з"="z"; "и"="i"; "і"="i"; "ї"="yi"; "й"="y"; "к"="k"; "л"="l"; "м"="m";
    "н"="n"; "о"="o"; "п"="p"; "р"="r"; "с"="s"; "т"="t"; "у"="u"; "ф"="f"; "х"="kh";
    "ц"="ts"; "ч"="ch"; "ш"="sh"; "щ"="shch"; "ъ"=""; "ы"="y"; "ь"=""; "э"="e"; "ю"="yu"; "я"="ya"
  }
  $builder = [System.Text.StringBuilder]::new()
  foreach ($char in $normalized.ToCharArray()) {
    $s = [string]$char
    if ($map.ContainsKey($s)) {
      [void]$builder.Append($map[$s])
    } elseif ($s -match "[a-z0-9]") {
      [void]$builder.Append($s)
    } else {
      [void]$builder.Append("-")
    }
  }
  $slug = [regex]::Replace($builder.ToString(), "-+", "-").Trim("-")
  if (-not $slug) { return "category" }
  return $slug
}

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ExcelPath))
try {
  $workbook = Load-Xml (Read-ZipText $zip "xl/workbook.xml")
  $rels = Load-Xml (Read-ZipText $zip "xl/_rels/workbook.xml.rels")
  $sharedXmlText = Read-ZipText $zip "xl/sharedStrings.xml"
  $sharedStrings = @()
  if ($sharedXmlText) {
    $sharedXml = Load-Xml $sharedXmlText
    foreach ($si in $sharedXml.GetElementsByTagName("si")) {
      $parts = $si.GetElementsByTagName("t") | ForEach-Object { $_."#text" }
      $sharedStrings += ($parts -join "")
    }
  }

  $relTargets = @{}
  foreach ($rel in $rels.Relationships.Relationship) {
    $relTargets[$rel.Id] = "xl/" + $rel.Target
  }

  $products = [System.Collections.Generic.List[object]]::new()
  $categories = [System.Collections.Generic.List[object]]::new()
  $usedSlugs = @{}
  $id = 1

  foreach ($sheet in $workbook.workbook.sheets.sheet) {
    $sheetName = [string]$sheet.name
    if ($sheetName -eq "Главная") { continue }
    $rid = $sheet.GetAttribute("id", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    $sheetPath = $relTargets[$rid]
    if (-not $sheetPath) { continue }

    $sheetXml = Load-Xml (Read-ZipText $zip $sheetPath)
    $currentSection = ""
    $slugBase = Slugify $sheetName
    $catSlug = $slugBase
    $slugIndex = 2
    while ($usedSlugs.ContainsKey($catSlug)) {
      $catSlug = "$slugBase-$slugIndex"
      $slugIndex++
    }
    $usedSlugs[$catSlug] = $true
    $categoryCountBefore = $products.Count

    foreach ($row in $sheetXml.GetElementsByTagName("row")) {
      $cells = @{}
      foreach ($cell in $row.GetElementsByTagName("c")) {
        $col = Cell-Column ([string]$cell.r)
        $cells[$col] = Normalize-Text (Get-CellValue $cell $sharedStrings)
      }

      $name = $cells["A"]
      if ([string]::IsNullOrWhiteSpace($name)) { continue }
      $qty = To-Number $cells["B"]
      $price = To-Number $cells["C"]

      # A section header is a row carrying ONLY a name: both the quantity and the
      # price cells are empty. Rows that have a quantity but no usable price
      # (empty cell, "переучет", "договорная") are priced-on-request PRODUCTS —
      # they are skipped, but they must not be mistaken for a section heading.
      # Testing "-or" here made 123 product names become section names and gave
      # one of them 588 products; see the section audit in ИСПРАВЛЕНИЯ.md.
      $hasQtyCell = -not [string]::IsNullOrWhiteSpace($cells["B"])
      $hasPriceCell = -not [string]::IsNullOrWhiteSpace($cells["C"])

      if (-not $hasQtyCell -and -not $hasPriceCell) {
        if ($name -notmatch "Наименование|Цена|Кол-во") {
          $currentSection = $name
        }
        continue
      }

      if ($null -eq $qty -or $null -eq $price) { continue }

      if ($price -le 0) { continue }

      $nameRu = Normalize-Text $name
      $sectionRu = Normalize-Text $currentSection
      $product = [ordered]@{
        id = $id
        sku = ("FLK-" + $id.ToString("00000"))
        categorySlug = $catSlug
        categoryRu = $sheetName
        categoryUa = Convert-ToUa $sheetName
        sectionRu = $sectionRu
        sectionUa = Convert-ToUa $sectionRu
        nameRu = $nameRu
        nameUa = Convert-ToUa $nameRu
        qty = [math]::Round($qty, 3)
        price = [math]::Round($price, 2)
        updatedAt = (Get-Date).ToString("yyyy-MM-dd")
      }
      $products.Add([pscustomobject]$product)
      $id++
    }

    $categories.Add([pscustomobject][ordered]@{
      slug = $catSlug
      ru = $sheetName
      ua = Convert-ToUa $sheetName
      count = $products.Count - $categoryCountBefore
    })
  }
} finally {
  $zip.Dispose()
}

$out = Resolve-Path -LiteralPath $OutDir
$assets = Join-Path $out "assets"
New-Item -ItemType Directory -Force -Path $assets | Out-Null
$priceUpdatedAt = (Get-Date).ToString("yyyy-MM-dd")

$data = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  priceUpdatedAt = $priceUpdatedAt
  store = [ordered]@{
    name = "FLAKS"
    email = "tpolegat@gmail.com"
    phone = "+380675453115"
    phoneDisplay = "+380 67 545 31 15"
    currency = "UAH"
    vat = "without VAT"
  }
  categories = $categories
  products = $products
}

$json = $data | ConvertTo-Json -Depth 8 -Compress
Set-Content -LiteralPath (Join-Path $out "data.js") -Value ("window.FLAKS_DATA = " + $json + ";") -Encoding UTF8

Write-Host "Generated $($products.Count) products in $($categories.Count) categories."

# Re-derive UA fields with the authoritative map in refresh-data-ua.mjs
# (the inline Convert-ToUa above is only a first pass). Note: the node
# script reads data.js next to itself, i.e. the repo-root copy.
if ((Resolve-Path $out).Path -eq (Resolve-Path $PSScriptRoot).Path) {
  & node (Join-Path $PSScriptRoot "refresh-data-ua.mjs") --write
} else {
  Write-Warning "OutDir differs from script root; run 'node refresh-data-ua.mjs --write' against $out\data.js manually."
}


