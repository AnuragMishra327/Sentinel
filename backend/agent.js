function analyzeChange(change) {
  if (!change.changed) {
    return {
      important: false,
      meaning: 'No meaningful change detected',
      action: 'ignore',
      notification: null,
    };
  }

  const previousText = change.previousContent || '';
  const currentText = change.currentContent || '';
  const details = change.details || [];

  const normalize = (text) =>
    String(text)
      .replace(/\s+/g, ' ')
      .trim();

  const addedText = normalize(
    details
      .filter((part) => part.type === 'added')
      .map((part) => part.text)
      .join(' ')
  );

  const removedText = normalize(
    details
      .filter((part) => part.type === 'removed')
      .map((part) => part.text)
      .join(' ')
  );

  /*
    IMPORTANT:
    Analyze primarily the text that actually changed,
    not the entire webpage.
  */
  const changedText = normalize(
    `${removedText} ${addedText}`
  ).toLowerCase();

  if (!changedText) {
    return {
      important: false,
      meaning: 'Minor page structure change detected',
      action: 'ignore',
      notification: null,
    };
  }

  function extractValue(content, labels) {
    for (const label of labels) {
      const escapedLabel = label.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      const regex = new RegExp(
        `${escapedLabel}\\s*[:\\-–]?\\s*([^\\n\\r]{1,120})`,
        'i'
      );

      const match = content.match(regex);

      if (match) {
        return normalize(match[1])
          .replace(/[.!]+$/, '')
          .slice(0, 120);
      }
    }

    return null;
  }

  function makeResult(meaning, notification) {
    return {
      important: true,
      meaning,
      action: 'notify',
      notification,
    };
  }

  /*
    PRICE DETECTION
    Handle prices separately because shopping pages
    frequently contain changing recommendations,
    banners, ads and navigation content.
  */
  const priceRegex =
    /(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?/gi;

  const oldPrices =
    previousText.match(priceRegex) || [];

  const newPrices =
    currentText.match(priceRegex) || [];

  const oldPrimaryPrice = oldPrices[0] || null;
  const newPrimaryPrice = newPrices[0] || null;

  if (
    oldPrimaryPrice &&
    newPrimaryPrice &&
    oldPrimaryPrice !== newPrimaryPrice
  ) {
    return makeResult(
      'Price changed',
      `🔔 Price changed: ${oldPrimaryPrice} → ${newPrimaryPrice}.`
    );
  }

  /*
    AVAILABILITY DETECTION
  */
  const availabilityTerms = [
    'in stock',
    'out of stock',
    'currently unavailable',
    'available',
    'sold out',
  ];

  const oldAvailability =
    availabilityTerms.find((term) =>
      previousText.toLowerCase().includes(term)
    ) || null;

  const newAvailability =
    availabilityTerms.find((term) =>
      currentText.toLowerCase().includes(term)
    ) || null;

  if (
    oldAvailability &&
    newAvailability &&
    oldAvailability !== newAvailability
  ) {
    return makeResult(
      'Availability changed',
      `🔔 Availability changed: ${oldAvailability} → ${newAvailability}.`
    );
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
        'application closes',
      ],
      keywords: [
        'deadline',
        'last date',
        'closing date',
        'application closes',
      ],
      message: 'Application deadline changed',
    },

    {
      name: 'Eligibility',
      labels: [
        'eligibility',
        'age limit',
        'minimum qualification',
        'educational qualification',
        'required qualification',
      ],
      keywords: [
        'eligibility',
        'age limit',
        'minimum qualification',
        'educational qualification',
        'required qualification',
      ],
      message: 'Eligibility information changed',
    },

    {
      name: 'Application or registration',
      labels: [
        'application status',
        'registration status',
        'application fee',
        'registration fee',
        'application opens',
        'registration opens',
      ],
      keywords: [
        'application',
        'apply',
        'registration',
      ],
      message: 'Application or registration update',
    },

    {
      name: 'Results or admissions',
      labels: [
        'result status',
        'result date',
        'admission status',
        'vacancy count',
        'number of vacancies',
      ],
      keywords: [
        'result',
        'admission',
        'vacancy',
        'merit list',
        'shortlist',
      ],
      message: 'Results, admission, or vacancy update',
    },

    {
      name: 'Notice or announcement',
      labels: [
        'notice',
        'notification',
        'announcement',
        'published date',
      ],
      keywords: [
        'notice',
        'notification',
        'announcement',
        'new circular',
      ],
      message: 'Notice or announcement update',
    },
  ];

  /*
    Only classify a category when the CHANGED text
    contains one of its important keywords.
  */
  for (const category of categories) {
    const matchedKeyword = category.keywords.some(
      (keyword) => changedText.includes(keyword)
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
      oldValue.toLowerCase() !==
        newValue.toLowerCase()
    ) {
      return makeResult(
        category.name,
        `🔔 ${category.message}: ${oldValue} → ${newValue}.`
      );
    }

    /*
      If relevant keywords themselves appeared/disappeared,
      create a short notification.
    */
    const summary = addedText || removedText;

    if (summary) {
      return makeResult(
        category.name,
        `🔔 ${category.message}: ${summary.slice(0, 220)}`
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
    'document verification',
  ];

  const matchedImportantKeyword =
    importantKeywords.find((keyword) =>
      changedText.includes(keyword)
    );

  if (matchedImportantKeyword) {
    const summary =
      addedText || removedText;

    return makeResult(
      'Important announcement',
      `🔔 Important update (${matchedImportantKeyword}): ${summary.slice(0, 220)}`
    );
  }

  return {
    important: false,
    meaning:
      'Minor or unclassified content change detected',
    action: 'ignore',
    notification: null,
  };
}

module.exports = {
  analyzeChange,
};