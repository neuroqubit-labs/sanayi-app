const TURKISH_CHAR_MAP = {
    c: /[çÇ]/g,
    g: /[ğĞ]/g,
    i: /[ıİ]/g,
    o: /[öÖ]/g,
    s: /[şŞ]/g,
    u: /[üÜ]/g,
};

export function slugifyTitle(title) {
    if (!title) return 'screen';

    let slug = title.trim();
    for (const [replacement, pattern] of Object.entries(TURKISH_CHAR_MAP)) {
        slug = slug.replace(pattern, replacement);
    }

    return slug
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'screen';
}

export function defineCapturePresets(actor, entries) {
    return entries.map((entry) => {
        const order = String(entry.order).padStart(2, '0');
        const captureMode = entry.captureMode || 'full';
        const outputPath = `docs/reference-screens/legacy/${actor}/${entry.group}/${order}-${entry.screenId}__${slugifyTitle(entry.title)}.png`;

        return {
            ...entry,
            actor,
            order,
            captureMode,
            navParams: entry.navParams || {},
            contextState: entry.contextState || {},
            storageSeed: entry.storageSeed || {},
            outputPath,
        };
    });
}

export function sortCapturePresets(presets) {
    return [...presets].sort((left, right) => {
        if (left.actor !== right.actor) return left.actor.localeCompare(right.actor);
        if (left.group !== right.group) return left.group.localeCompare(right.group);
        return left.order.localeCompare(right.order);
    });
}
