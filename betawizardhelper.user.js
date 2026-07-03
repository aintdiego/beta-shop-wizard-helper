// ==UserScript==
// @name         Shop Wizard Beta Price Check Helper
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Keep the N cheapest prices between refreshes
// @author       aintdiego
// @match        *://www.neopets.com/shops/wizard.phtml*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

// How many of the cheapest results to keep around between refreshes
const MAX_STORED_RESULTS = 3;

// Let's clear stored values because this is a new search making them no longer relevant
GM_deleteValue('cheapest_results');

// Here we are mapping each letter to their corresponding search group
const result_groups = [
    ['A', 'A, N, 0'], ['N', 'A, N, 0'], ['0', 'A, N, 0'],
    ['B', 'B, O, 1'], ['O', 'B, O, 1'], ['1', 'B, O, 1'],
    ['C', 'C, P, 2'], ['P', 'C, P, 2'], ['2', 'C, P, 2'],
    ['D', 'D, Q, 3'], ['Q', 'D, Q, 3'], ['3', 'D, Q, 3'],
    ['E', 'E, R, 4'], ['R', 'E, R, 4'], ['4', 'E, R, 4'],
    ['F', 'F, S, 5'], ['S', 'F, S, 5'], ['5', 'F, S, 5'],
    ['G', 'G, T, 6'], ['T', 'G, T, 6'], ['6', 'G, T, 6'],
    ['H', 'H, U, 7'], ['U', 'H, U, 7'], ['7', 'H, U, 7'],
    ['I', 'I, V, 8'], ['V', 'I, V, 8'], ['8', 'I, V, 8'],
    ['J', 'J, W, 9'], ['W', 'J, W, 9'], ['9', 'J, W, 9'],
    ['K', 'K, X, _'], ['X', 'K, X, _'], ['_', 'K, X, _'],
    ['L', 'L, Y'], ['Y', 'L, Y'],
    ['M', 'M, Z'], ['Z', 'M, Z'],
];
const groups_map = new Map(result_groups);

// This will be used to show the groups on the page
const results_for_display = [
    'A, N, 0', 'B, O, 1', 'C, P, 2',
    'D, Q, 3', 'E, R, 4', 'F, S, 5',
    'G, T, 6', 'H, U, 7', 'I, V, 8',
    'J, W, 9', 'K, X, _', 'L, Y',
    'M, Z',
];

// Here we will store the groups that have already been visited
const visited_groups = new Set();

// To highlight the current group
let current_group = null;

function saveCheapest()
{
    // We need to ignore the first row because it serves as a header for the results table
    const cheapest_row = $('.wizard-results-grid.wizard-results-grid-shop')
        .find('li:not(.wizard-results-grid-header):not(.stored-result)')
        .first();

    if (cheapest_row.length === 0) {
        // No results found, probably
        return;
    }

    const shop_owner = cheapest_row.children('a').first().text();
    const price = cheapest_row.children('.wizard-results-price').first().text();
    // Strip everything that isn't a digit (thousands separators, the " NP" suffix, etc.)
    const formatted_price = parseInt(price.replace(/\D/g, ''), 10);

    // Let's add some color and then wrap it in a irrelevant tag to be able to store the tag itself
    const cheapest_html = cheapest_row
        .clone()
        .addClass('stored-result')
        .attr('style', 'background-color: #ffff90 !important;')
        .wrap('<p/>')
        .parent()
        .html();

    storeCheapestCandidate(shop_owner, formatted_price, cheapest_html);
    markGroupAsVisited(shop_owner);
}

function storeCheapestCandidate(owner, price, html)
{
    let results = GM_getValue('cheapest_results', []);

    // Drop any earlier entry for this same shop, it's about to be replaced with fresh data
    results = results.filter((result) => result.owner !== owner);

    // Put the new candidate first: on a price tie the stable sort below keeps it ahead
    // of older entries, so it survives the truncation. An older match at the same price
    // is more likely to already be sold out, so the most recent one should win the slot.
    results.unshift({ owner, price, html });
    results.sort((a, b) => a.price - b.price);

    GM_setValue('cheapest_results', results.slice(0, MAX_STORED_RESULTS));
}

function markGroupAsVisited(shop_owner)
{
    const first_letter = shop_owner.substr(0, 1).toUpperCase();
    current_group = groups_map.get(first_letter);
    visited_groups.add(groups_map.get(first_letter));
}

function showGroups()
{
    // Let's add the groups section if it's not there already
    if ($('#groups').length === 0) {
        $('.wizard-results-header').after('<div id="groups" style="display: flex;justify-content: center;align-items: center;"></div>');
    }

    const groups_section = $('#groups');

    const content = results_for_display.map((group) => {
        const is_visited = visited_groups.has(group);
        const button_color = is_visited && group === current_group ? 'button-red__2020' : 'button-blue__2020';
        const opacity = is_visited ? 1 : 0.1;

        return `<input
                    class="button-default__2020 ${button_color} btn-single__2020 wizard-button__2020 group-button"
                    type="submit"
                    value="${group}"
                    style="opacity: ${opacity};"
                >`;
    }).join('');

    groups_section.html(content);
}

function addCheapestResults()
{
    let results_header = $('.wizard-results-grid.wizard-results-grid-shop')
        .find('.wizard-results-grid-header')
        .first();

    if (results_header.length === 0) {
        // No results found, probably. Let's attach the results table to show the last cheapest stores
        $('#groups')
        .after(`<div id="custom-results" class="wizard-results-grid wizard-results-grid-shop">
                    <ul>
                        <li class="wizard-results-grid-header">
				            <h3>Shop Owner</h3>
				            <h3>Stock</h3>
                            <h3>Price</h3>
                        </li>
                    </ul>
                </div>`);

        results_header = $('.wizard-results-grid.wizard-results-grid-shop')
        .find('.wizard-results-grid-header')
        .first();
    } else {
        // Results found, let's remove the manually placed results, if any
        $('#custom-results').remove();
    }

    const cheapest_results = GM_getValue('cheapest_results', []);

    $('.stored-result').remove();

    // A stored result might belong to a shop that's already showing in this page's own
    // results; in that case highlight the live row instead of appending a duplicate.
    const live_rows = $('.wizard-results-grid.wizard-results-grid-shop')
        .find('li:not(.wizard-results-grid-header):not(.stored-result)');

    const rows_to_append = [];

    cheapest_results.forEach((result) => {
        const matching_row = live_rows.filter((_, row) => $(row).children('a').first().text() === result.owner);

        if (matching_row.length > 0) {
            matching_row.attr('style', 'background-color: #ffff90 !important;');
        } else {
            rows_to_append.push(result.html);
        }
    });

    if (rows_to_append.length > 0) {
        results_header.after(rows_to_append.join(''));
    }
}

// The search always returns a random result group, which can repeat between searches.
// Without a loading indicator there's no way to tell a fresh search from a stale page,
// so we un-highlight the current group as soon as the search starts and only highlight
// it again once the new results come back.
$(document).ajaxSend(function () {
    current_group = null;
    showGroups();
});

$(document).ajaxSuccess(function () {
    saveCheapest();
    showGroups();
    addCheapestResults();
});

const sswButton = $('.navsub-ssw-icon__2020');

if( document.URL.includes('/shops/wizard.phtml') && sswButton.length ) {
    $('#ssw__2020').css('display', 'block');
    $('#searchstr').val($('#shopwizard').val());
}
