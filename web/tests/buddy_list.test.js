"use strict";

const {strict: assert} = require("assert");

const _ = require("lodash");

const {mock_esm, zrequire} = require("./lib/namespace");
const {run_test} = require("./lib/test");
const blueslip = require("./lib/zblueslip");
const $ = require("./lib/zjquery");

const padded_widget = mock_esm("../src/padded_widget");
const message_viewport = mock_esm("../src/message_viewport");

const buddy_data = zrequire("buddy_data");
const {BuddyList} = zrequire("buddy_list");
const people = zrequire("people");

function init_simulated_scrolling() {
    const elem = {
        dataset: {},
        scrollTop: 0,
        scrollHeight: 0,
    };

    $.create("#buddy_list_wrapper", {children: [elem]});

    $("#buddy_list_wrapper_padding").set_height(0);

    return elem;
}

const alice = {
    email: "alice@zulip.com",
    user_id: 10,
    full_name: "Alice Smith",
};
people.add_active_user(alice);
const bob = {
    email: "bob@zulip.com",
    user_id: 15,
    full_name: "Bob Smith",
};
people.add_active_user(bob);
const $alice_li = $.create("alice-stub");
const $bob_li = $.create("bob-stub");

run_test("get_items", () => {
    const buddy_list = new BuddyList();

    const $narrow_users_container = $.create("get_items #narrow-user-presences", {
        children: [{to_$: () => $alice_li}],
    });
    const $other_users_container = $.create("get_items #other-user-presences", {
        children: [{to_$: () => $bob_li}],
    });
    const sel = "li.user_sidebar_entry";
    buddy_list.$narrow_users_container.set_find_results(sel, $narrow_users_container);
    buddy_list.$other_users_container.set_find_results(sel, $other_users_container);

    const items = buddy_list.get_items();
    assert.deepEqual(items, [$alice_li, $bob_li]);
});

run_test("basics", ({override}) => {
    const buddy_list = new BuddyList();
    init_simulated_scrolling();

    override(buddy_list, "items_to_html", () => "html-stub");
    override(message_viewport, "height", () => 550);
    override(padded_widget, "update_padding", () => {});
    // Set to an empty list since we're not testing CSS.
    $("#narrow-user-presences").children = () => [];

    let appended_to_narrow_users;
    $("#narrow-user-presences").append = (html) => {
        assert.equal(html, "html-stub");
        appended_to_narrow_users = true;
    };

    buddy_list.populate({
        keys: [alice.user_id],
    });
    assert.ok(appended_to_narrow_users);

    const $alice_li = "alice-stub";

    override(buddy_list, "get_li_from_key", (opts) => {
        const key = opts.key;

        assert.equal(key, alice.user_id);
        return $alice_li;
    });

    const $li = buddy_list.find_li({
        key: alice.user_id,
    });
    assert.equal($li, $alice_li);
});

let narrow_users = [];
function buddy_list_add_narrow_user(user_id, $stub) {
    if ($stub.attr) {
        $stub.attr("data-user-id", user_id);
    }
    $stub.length = 1;
    narrow_users.push(user_id);
    const sel = `li.user_sidebar_entry[data-user-id='${CSS.escape(user_id)}']`;
    $("#narrow-user-presences").set_find_results(sel, $stub);
    $("#other-user-presences").set_find_results(sel, []);
}

let other_users = [];
function buddy_list_add_other_user(user_id, $stub) {
    if ($stub.attr) {
        $stub.attr("data-user-id", user_id);
    }
    $stub.length = 1;
    other_users.push(user_id);
    const sel = `li.user_sidebar_entry[data-user-id='${CSS.escape(user_id)}']`;
    $("#other-user-presences").set_find_results(sel, $stub);
    $("#narrow-user-presences").set_find_results(sel, []);
}

function override_user_matches_narrow(user_id) {
    return narrow_users.includes(user_id);
}

function clear_buddy_list(buddy_list) {
    buddy_list.populate({
        keys: [],
    });
    narrow_users = [];
    other_users = [];
}

run_test("split list", ({override, override_rewire}) => {
    const buddy_list = new BuddyList();
    init_simulated_scrolling();

    override_rewire(buddy_data, "user_matches_narrow", override_user_matches_narrow);

    override(buddy_list, "items_to_html", (opts) => {
        if (opts.items.length > 0) {
            return "html-stub";
        }
        return "empty";
    });
    override(message_viewport, "height", () => 550);
    override(padded_widget, "update_padding", () => {});
    // Set to an empty list since we're not testing CSS.
    $("#narrow-user-presences").children = () => [];

    let appended_to_narrow_users = false;
    $("#narrow-user-presences").append = (html) => {
        if (html === "html-stub") {
            appended_to_narrow_users = true;
        } else {
            assert.equal(html, "empty");
        }
    };

    let appended_to_other_users = false;
    $("#other-user-presences").append = (html) => {
        if (html === "html-stub") {
            appended_to_other_users = true;
        } else {
            assert.equal(html, "empty");
        }
    };

    // one narrow user
    buddy_list_add_narrow_user(alice.user_id, $alice_li);
    buddy_list.populate({
        keys: [alice.user_id],
    });
    assert.ok(appended_to_narrow_users);
    assert.ok(!appended_to_other_users);
    appended_to_narrow_users = false;

    // one other user
    clear_buddy_list(buddy_list);
    buddy_list_add_other_user(alice.user_id, $alice_li);
    buddy_list.populate({
        keys: [alice.user_id],
    });
    assert.ok(!appended_to_narrow_users);
    assert.ok(appended_to_other_users);
    appended_to_other_users = false;

    // a narrow user and an other user
    clear_buddy_list(buddy_list);
    buddy_list_add_narrow_user(alice.user_id, $alice_li);
    buddy_list_add_other_user(bob.user_id, $bob_li);
    buddy_list.populate({
        keys: [alice.user_id, bob.user_id],
    });
    assert.ok(appended_to_narrow_users);
    assert.ok(appended_to_other_users);
});

run_test("find_li", ({override}) => {
    const buddy_list = new BuddyList();

    override(buddy_list, "fill_screen_with_content", () => {});

    clear_buddy_list(buddy_list);
    buddy_list_add_narrow_user(alice.user_id, $alice_li);
    buddy_list_add_other_user(bob.user_id, $bob_li);

    let $li = buddy_list.find_li({
        key: alice.user_id,
    });
    assert.equal($li, $alice_li);

    $li = buddy_list.find_li({
        key: bob.user_id,
    });
    assert.equal($li, $bob_li);
});

run_test("big_list", ({override}) => {
    const buddy_list = new BuddyList();
    const elem = init_simulated_scrolling();

    // Don't actually render, but do simulate filling up
    // the screen.
    let chunks_inserted = 0;

    override(buddy_list, "render_more", () => {
        elem.scrollHeight += 100;
        chunks_inserted += 1;
    });
    override(message_viewport, "height", () => 550);

    // We will have more than enough users, but still
    // only do 6 chunks of data.
    const num_users = 300;
    const user_ids = [];

    _.times(num_users, (i) => {
        const person = {
            email: "foo" + i + "@zulip.com",
            user_id: 100 + i,
            full_name: "Somebody " + i,
        };
        people.add_active_user(person);
        user_ids.push(person.user_id);
    });

    buddy_list.populate({
        keys: user_ids,
    });

    assert.equal(chunks_inserted, 6);
});

run_test("force_render", ({override}) => {
    const buddy_list = new BuddyList();
    buddy_list.render_count = 50;

    let num_rendered = 0;
    override(buddy_list, "render_more", (opts) => {
        num_rendered += opts.chunk_size;
    });

    buddy_list.force_render({
        pos: 60,
    });

    assert.equal(num_rendered, 60 - 50 + 3);

    // Force a contrived error case for line coverage.
    blueslip.expect("error", "cannot show key at this position");
    buddy_list.force_render({
        pos: 10,
    });
});

run_test("find_li w/force_render", ({override}) => {
    const buddy_list = new BuddyList();

    // If we call find_li w/force_render set, and the
    // key is not already rendered in DOM, then the
    // widget will call show_key to force-render it.
    const key = "999";
    const $stub_li = "stub-li";

    override(buddy_list, "get_li_from_key", (opts) => {
        assert.equal(opts.key, key);
        return $stub_li;
    });

    buddy_list.all_user_ids = ["foo", "bar", key, "baz"];

    let shown;

    override(buddy_list, "force_render", (opts) => {
        assert.equal(opts.pos, 2);
        shown = true;
    });

    const $hidden_li = buddy_list.find_li({
        key,
    });
    assert.equal($hidden_li, $stub_li);
    assert.ok(!shown);

    const $li = buddy_list.find_li({
        key,
        force_render: true,
    });

    assert.equal($li, $stub_li);
    assert.ok(shown);
});

run_test("find_li w/bad key", ({override}) => {
    const buddy_list = new BuddyList();
    override(buddy_list, "get_li_from_key", () => "stub-li");

    const $undefined_li = buddy_list.find_li({
        key: "not-there",
        force_render: true,
    });

    assert.deepEqual($undefined_li, []);
});

run_test("scrolling", ({override}) => {
    const buddy_list = new BuddyList();
    let tried_to_fill;
    override(buddy_list, "fill_screen_with_content", () => {
        tried_to_fill = true;
    });
    init_simulated_scrolling();

    buddy_list.populate({
        keys: [],
    });
    assert.ok(tried_to_fill);
    tried_to_fill = false;

    buddy_list.start_scroll_handler();
    $(buddy_list.scroll_container_sel).trigger("scroll");

    assert.ok(tried_to_fill);
});
