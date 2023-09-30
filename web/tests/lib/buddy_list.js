"use strict";

const $ = require("./zjquery");

let narrow_users = [];
exports.buddy_list_add_narrow_user = (user_id, $stub) => {
    if ($stub.attr) {
        $stub.attr("data-user-id", user_id);
    }
    $stub.length = 1;
    narrow_users.push(user_id);
    const sel = `li.user_sidebar_entry[data-user-id='${CSS.escape(user_id)}']`;
    $("#narrow-user-presences").set_find_results(sel, $stub);
    $("#other-user-presences").set_find_results(sel, []);
};

let other_users = [];
exports.buddy_list_add_other_user = (user_id, $stub) => {
    if ($stub.attr) {
        $stub.attr("data-user-id", user_id);
    }
    $stub.length = 1;
    other_users.push(user_id);
    const sel = `li.user_sidebar_entry[data-user-id='${CSS.escape(user_id)}']`;
    $("#other-user-presences").set_find_results(sel, $stub);
    $("#narrow-user-presences").set_find_results(sel, []);
};

exports.override_user_matches_narrow = (user_id) => narrow_users.includes(user_id);

exports.clear_buddy_list = (buddy_list) => {
    buddy_list.populate({
        keys: [],
    });
    narrow_users = [];
    other_users = [];
};
