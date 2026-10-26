
function analyzeChange(change) {
  if (!change.changed) {
    return {
      important: false,
      meaning: 'No meaningful change detected',
      action: 'ignore',
      notification: null
    };
  }

  const previousText = change.previousContent || '';
  const currentText = change.currentContent || '';
  const details = change.details || [];

  const addedText = details
    .filter(part => part.type === 'added')
    .map(part => part.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const removedText = details
    .filter(part => part.type === 'removed')
    .map(part => part.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const combinedText =
    `${previousText} ${currentText}`.toLowerCase();

  function extractValue(content, labels) {
    for (const label of labels) {
      const escapedLabel = label.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      const regex = new RegExp(
        `(?:^|[.!?]\\s*|\\s)${escapedLabel}\\s*[:\\-–]\\s*([^\\n\\r]+?)(?=\\s{2,}|$)`,
        'im'
      );

      const match = content.match(regex);

      if (match) {
        return match[1].trim().replace(/[.!]+$/, '');
      }
    }

    return null;
  }

  function makeResult(meaning, notification) {
    return {
      important: true,
      meaning,
      action: 'notify',
      notification
    };
  }

  const categories = [
    {
      name: 'Application deadline',
      labels: [
        'application deadline',
        'deadline',
        'last date',
        'closing date',
        'registration deadline',
        'application closes'
      ],
      keywords: [
        'deadline',
        'last date',
        'closing date',
        'application closes'
      ],
      message: 'Application deadline changed'
    },
    {
      name: 'Eligibility',
      labels: [
        'eligibility',
        'age limit',
        'minimum qualification',
        'educational qualification',
        'required qualification'
      ],
      keywords: [
        'eligibility',
        'age limit',
        'minimum qualification',
        'educational qualification',
        'required qualification'
      ],
      message: 'Eligibility information changed'
    },
    {
      name: 'Application or registration',
      labels: [
        'application status',
        'registration status',
        'application fee',
        'registration fee',
        'application opens',
        'registration opens'
      ],
      keywords: [
        'application',
        'apply',
        'registration'
      ],
      message: 'Application or registration update'
    },
    {
      name: 'Results or admissions',
      labels: [
        'result status',
        'result date',
        'admission status',
        'vacancy count',
        'number of vacancies'
      ],
      keywords: [
        'result',
        'admission',
        'vacancy',
        'merit list',
        'shortlist'
      ],
      message: 'Results, admission, or vacancy update'
    },
    {
      name: 'Price or availability',
      labels: [
        'price',
        'application fee',
        'availability',
        'status',
        'seats available'
      ],
      keywords: [
        'price',
        'available',
        'unavailable',
        'sold out',
        'in stock',
        'out of stock'
      ],
      message: 'Price or availability update'
    },
    {
      name: 'Notice or announcement',
      labels: [
        'notice',
        'notification',
        'announcement',
        'published date'
      ],
      keywords: [
        'notice',
        'notification',
        'announcement',
        'new circular'
      ],
      message: 'Notice or announcement update'
    }
  ];

  for (const category of categories) {
    const matchedKeyword = category.keywords.some(keyword =>
      combinedText.includes(keyword)
    );

    if (!matchedKeyword) {
      continue;
    }

    const oldValue = extractValue(
      previousText,
      category.labels
    );

    const newValue = extractValue(
      currentText,
      category.labels
    );

    if (
      oldValue &&
      newValue &&
      oldValue.toLowerCase() !== newValue.toLowerCase()
    ) {
      return makeResult(
        category.name,
        `🔔 ${category.message}: ${oldValue} → ${newValue}.`
      );
    }

    if (addedText || removedText) {
      const summary = addedText || removedText;

      return makeResult(
        category.name,
        `🔔 ${category.message}: ${summary}`
      );
    }
  }

  const importantKeywords = [
    'postponed',
    'extended',
    'cancelled',
    'canceled',
    'rescheduled',
    'correction window',
    'admit card',
    'hall ticket',
    'final merit list',
    'document verification'
  ];

  const matchedImportantKeyword = importantKeywords.find(keyword =>
    combinedText.includes(keyword)
  );

  if (matchedImportantKeyword && (addedText || removedText)) {
    return makeResult(
      'Important announcement',
      `🔔 Important update (${matchedImportantKeyword}): ${
        addedText || removedText
      }`
    );
  }

  return {
    important: false,
    meaning: 'Minor or unclassified content change detected',
    action: 'ignore',
    notification: null
  };
}

module.exports = {
  analyzeChange
};
