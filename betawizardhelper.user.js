// ==UserScript==
// @name         Shop Wizard Beta Price Check Helper
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Keep the cheapest price between refreshes
// @author       aintdiego
// @match        *://www.neopets.com/shops/wizard.phtml*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// ==/UserScript==

// Let's clear stored values because this is a new search making them no longer relevant
GM_deleteValue('current_cheapest');
GM_deleteValue('cheapest_html');
GM_deleteValue('cheapest_owner');

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
var current_group = null;

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
    const formatted_price = parseInt(price.slice(0, -3).replace(/,/g, ""));
    const current_cheapest = GM_getValue('current_cheapest');

    if (!current_cheapest || formatted_price < current_cheapest) {
        GM_setValue('current_cheapest', formatted_price);

        // Let's add some color and then wrap it in a irrelevant tag to be able to store the tag itself
        const cheapest_html = cheapest_row
        .clone()
        .addClass('stored-result')
        .attr('style', 'background-color: #ffff90 !important;')
        .wrap('<p/>')
        .parent()
        .html();

        GM_setValue('cheapest_html', cheapest_html);
        GM_setValue('cheapest_owner', shop_owner); // Let's also store the owner to avoid duplicating rows
    }

    markGroupAsVisited(shop_owner);
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

    var content = "";

    results_for_display.forEach((group, index) => {
        let button_color = "button-blue__2020";

        if (visited_groups.has(group)) {
            if (group == current_group) {
                button_color = "button-red__2020";
            }

            content += `<input
                            class="button-default__2020 ${button_color} btn-single__2020 wizard-button__2020"
                            id="refreshresults"
                            type="submit"
                            value="${group}"
                            style="opacity: 1;"
                        >`;
        } else {
            content += `<input
                            class="button-default__2020 ${button_color} btn-single__2020 wizard-button__2020"
                            id="refreshresults"
                            type="submit"
                            value="${group}"
                            style="opacity: 0.1;"
                        >`;
        }
    });

    groups_section.html(content);
}

function addCheapest()
{
    let results_header = $('.wizard-results-grid.wizard-results-grid-shop')
        .find('.wizard-results-grid-header')
        .first();

    if (results_header.length === 0) {
        // No results found, probably. Let's attach the results table to show the last cheapest store
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
        // Results found, let's remove the manually placed result, if any
        $('#custom-results').remove();
    }

    const cheapest_html = GM_getValue('cheapest_html');

    if (!cheapest_html) {
        return;
    }

    const current_cheapest_row = $('.wizard-results-grid.wizard-results-grid-shop')
        .find('li:not(.wizard-results-grid-header):not(.stored-result)')
        .first();
    const current_owner = current_cheapest_row.children('a').first().text();

    const cheapest_owner = GM_getValue('cheapest_owner');

    $('.stored-result').remove();

    if (cheapest_owner === current_owner) {
        current_cheapest_row.attr('style', 'background-color: #ffff90 !important;');
    } else {
        results_header.after(cheapest_html);
    }
}

$(document).ajaxSuccess(function () {
    current_group = null;

    saveCheapest();
    showGroups();
    addCheapest();
});
