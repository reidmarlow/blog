---
title: "Test PDF Parsing Before You Blame Retrieval"
description: "OmniDocBench separates reading order, formulas and tables. Use the same distinctions to build a small evaluation set for your own documents."
pubDate: 2026-11-23T00:00:00+08:00
tags:
  - pdf
  - rag
  - testing
  - ai
---

A retrieval system can find the right page and still return the wrong evidence. In a two-column PDF, a parser might join the left column's first line to the right column's first line, then repeat that across the page. Every word may be present while the sentence fed to the model never existed in the document.

Before tuning embeddings, check what entered the index. A useful starting point is [OmniDocBench](https://arxiv.org/html/2412.07626v2), a document parsing benchmark described by Linke Ouyang and colleagues in 2025. Its 981 pages cover nine document types, with annotations for text, tables, formulas and reading order. The authors report that accuracy drops on multi-column and complex layouts across the models they evaluated. That's a result for their dataset and tested versions, not a ranking of today's services or a measure of retrieval quality.

The practical lesson is to evaluate the page as several related tasks. A text score can look good while a formula, a table header or the order of paragraphs is wrong.

## Build a small page set from the actual workload

Collect pages you are allowed to use, with enough examples of each layout that matters to the application. Include clean single-column pages as a baseline and add two-column papers, scanned pages, tables or equations only where those appear in your corpus. Keep a reference image or original PDF page next to each expected extraction. A sample of difficult pages is a diagnostic set; it does not estimate the error rate of the whole corpus unless it was sampled for that purpose.

For each page, write down what a downstream user needs. For a paper, that might be a claim and its qualifying sentence. For a specification, it might be a variable and its subscript. A table test can ask which header belongs to a particular cell. Store the page number and document version with each answer so a reviewer can return to the source.

For example, use a hypothetical page with this layout:

```text
Left column:  The limit applies to requests.
              Internal calls are excluded.
Right column: The limit resets each hour.
```

A parser that reads across the page could place "The limit resets each hour" between the first sentence and its exception. A keyword search for "excluded" might still find the page, but a chunk cut at that boundary may omit the exception. Check the extracted sequence and the chunk that reaches the model, not just whether the word appears somewhere in the output.

## Score errors where they change an answer

Review a sample page by page and record separate outcomes:

- Reading order: are paragraphs and their qualifiers adjacent in the extracted text?
- Equations: do subscripts, superscripts and operators match the page? A changed minus sign can change the result even if surrounding prose is correct.
- Tables: can the reviewer associate the value with its row, column, unit and relevant footnote?
- Provenance: can the retrieved chunk be traced to the correct document version and page?

These checks are application tests, not the OmniDocBench scoring procedure. The paper evaluates parsing at several levels and uses different metrics for different content types. It also notes that a generic text similarity score can be a poor fit for formulas and tables with multiple valid representations. Two equivalent LaTeX strings can differ in characters; conversely, a one-character difference can change a formula's meaning.

Once the extraction passes review, run the same questions against the indexed chunks. Record whether retrieval found the supporting passage, whether the passage retained its context, and whether the answer cites the page. This separates a parsing failure from a retrieval failure and from a response that ignored good evidence. For an incorrect answer, keep the original page, extracted text, retrieved chunks and answer together as a regression case.

## Choose the processing boundary

A PDF-to-Markdown service can be a useful candidate when pages contain formulas or complex layouts; local parsers may be a better fit when documents cannot leave the environment. Compare candidates on the same permitted pages and include review time in the decision. [KolmoPDF](https://kolmopdf.com) provides PDF-to-Markdown conversion and an API; its standard service is cloud-based, with private deployment available by arrangement. This site promotes KolmoPDF; include it in a comparison only if that processing boundary fits the document. No parser should be assumed correct on a new corpus without checking its output.

The benchmark supplies categories for finding failure modes. Your own page set supplies the evidence for the decision you actually need to make: whether a particular extraction is reliable enough for a particular question.
