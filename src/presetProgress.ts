export function matchingPrefixLength(currentText: string, presetContent: string): number {
    let currentIndex = 0;
    let presetIndex = 0;

    while (currentIndex < currentText.length && presetIndex < presetContent.length) {
        const currentNewlineLength = newlineLengthAt(currentText, currentIndex);
        const presetNewlineLength = newlineLengthAt(presetContent, presetIndex);

        if (currentNewlineLength > 0 && presetNewlineLength > 0) {
            currentIndex += currentNewlineLength;
            presetIndex += presetNewlineLength;
            continue;
        }

        if (currentText[currentIndex] !== presetContent[presetIndex]) {
            break;
        }

        currentIndex++;
        presetIndex++;
    }

    return presetIndex;
}

function newlineLengthAt(text: string, index: number): number {
    if (text[index] === '\r' && text[index + 1] === '\n') {
        return 2;
    }

    return text[index] === '\n' ? 1 : 0;
}

export function advancePresetIndex(currentIndex: number, currentText: string, presetContent: string): number {
    return Math.max(currentIndex, matchingPrefixLength(currentText, presetContent));
}

export function reconcilePresetIndex(
    currentIndex: number,
    currentText: string,
    presetContent: string,
    allowRollback: boolean
): number {
    const matchIndex = matchingPrefixLength(currentText, presetContent);
    return allowRollback ? matchIndex : Math.max(currentIndex, matchIndex);
}

export function retreatPresetIndex(
    currentIndex: number,
    presetContent: string,
    logicalCharacters: number = 1
): number {
    let nextIndex = Math.min(Math.max(currentIndex, 0), presetContent.length);

    for (let count = 0; count < logicalCharacters && nextIndex > 0; count++) {
        if (
            nextIndex >= 2 &&
            presetContent[nextIndex - 2] === '\r' &&
            presetContent[nextIndex - 1] === '\n'
        ) {
            nextIndex -= 2;
            continue;
        }

        const previousCodeUnit = presetContent.charCodeAt(nextIndex - 1);
        if (
            nextIndex >= 2 &&
            previousCodeUnit >= 0xDC00 &&
            previousCodeUnit <= 0xDFFF
        ) {
            const leadingCodeUnit = presetContent.charCodeAt(nextIndex - 2);
            if (leadingCodeUnit >= 0xD800 && leadingCodeUnit <= 0xDBFF) {
                nextIndex -= 2;
                continue;
            }
        }

        nextIndex--;
    }

    return nextIndex;
}

export function advancePresetIndexFromInsertedText(
    currentIndex: number,
    insertedText: string,
    replacedTextLength: number,
    presetContent: string
): number {
    if (!insertedText) {
        return currentIndex;
    }

    let furthestIndex = currentIndex;
    for (const replacementStart of replacementStartCandidates(
        currentIndex,
        replacedTextLength,
        presetContent
    )) {
        const endIndex = matchInsertedTextAt(insertedText, presetContent, replacementStart);
        if (endIndex !== undefined && endIndex > furthestIndex) {
            furthestIndex = endIndex;
        }
    }

    return furthestIndex;
}

export function isExpectedPresetWrite(activeText: string, insertedText: string): boolean {
    return activeText.replace(/\r\n/g, '\n') === insertedText.replace(/\r\n/g, '\n');
}

function replacementStartCandidates(
    currentIndex: number,
    replacedTextLength: number,
    presetContent: string
): number[] {
    const targetLength = Math.max(0, replacedTextLength);
    const candidates: number[] = [];
    let presetIndex = Math.min(Math.max(0, currentIndex), presetContent.length);
    let minimumDocumentLength = 0;
    let maximumDocumentLength = 0;

    if (targetLength === 0) {
        candidates.push(presetIndex);
    }

    while (presetIndex > 0 && minimumDocumentLength <= targetLength) {
        if (
            presetIndex >= 2 &&
            presetContent[presetIndex - 2] === '\r' &&
            presetContent[presetIndex - 1] === '\n'
        ) {
            presetIndex -= 2;
            minimumDocumentLength += 1;
            maximumDocumentLength += 2;
        } else if (presetContent[presetIndex - 1] === '\n') {
            presetIndex--;
            minimumDocumentLength += 1;
            maximumDocumentLength += 2;
        } else {
            const previousCodeUnit = presetContent.charCodeAt(presetIndex - 1);
            if (
                presetIndex >= 2 &&
                previousCodeUnit >= 0xDC00 &&
                previousCodeUnit <= 0xDFFF
            ) {
                const leadingCodeUnit = presetContent.charCodeAt(presetIndex - 2);
                if (leadingCodeUnit >= 0xD800 && leadingCodeUnit <= 0xDBFF) {
                    presetIndex -= 2;
                    minimumDocumentLength += 2;
                    maximumDocumentLength += 2;
                } else {
                    presetIndex--;
                    minimumDocumentLength++;
                    maximumDocumentLength++;
                }
            } else {
                presetIndex--;
                minimumDocumentLength++;
                maximumDocumentLength++;
            }
        }

        if (
            targetLength >= minimumDocumentLength &&
            targetLength <= maximumDocumentLength
        ) {
            candidates.push(presetIndex);
        }
    }

    return candidates;
}

function matchInsertedTextAt(
    insertedText: string,
    presetContent: string,
    presetStartIndex: number
): number | undefined {
    let insertedIndex = 0;
    let presetIndex = presetStartIndex;

    while (insertedIndex < insertedText.length && presetIndex < presetContent.length) {
        const insertedNewlineLength = newlineLengthAt(insertedText, insertedIndex);
        const presetNewlineLength = newlineLengthAt(presetContent, presetIndex);

        if (insertedNewlineLength > 0 && presetNewlineLength > 0) {
            insertedIndex += insertedNewlineLength;
            presetIndex += presetNewlineLength;
            continue;
        }

        if (insertedText[insertedIndex] !== presetContent[presetIndex]) {
            return undefined;
        }

        insertedIndex++;
        presetIndex++;
    }

    return insertedIndex === insertedText.length ? presetIndex : undefined;
}
