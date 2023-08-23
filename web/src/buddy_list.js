import $ from "jquery";

import render_presence_row from "../templates/presence_row.hbs";
import render_presence_rows from "../templates/presence_rows.hbs";

import * as blueslip from "./blueslip";
import * as buddy_data from "./buddy_data";
import * as message_viewport from "./message_viewport";
import * as narrow_state from "./narrow_state";
import * as padded_widget from "./padded_widget";
import * as people from "./people";
import * as scroll_util from "./scroll_util";

class BuddyListConf {
    narrow_container_sel = "#narrow-user-presences";
    other_container_sel = "#other-user-presences";
    scroll_container_sel = "#buddy_list_wrapper";
    item_sel = "li.user_sidebar_entry";
    padding_sel = "#buddy_list_wrapper_padding";

    items_to_html(opts) {
        const html = render_presence_rows({presence_rows: opts.items});
        return html;
    }

    item_to_html(opts) {
        const html = render_presence_row(opts.item);
        return html;
    }

    get_li_from_key(opts) {
        const user_id = opts.key;
        const $narrow_users_container = $(this.narrow_container_sel);
        const $li = $narrow_users_container.find(
            `${this.item_sel}[data-user-id='${CSS.escape(user_id)}']`,
        );
        if ($li.length > 0) {
            return $li;
        }

        const $other_users_container = $(this.other_container_sel);
        return $other_users_container.find(
            `${this.item_sel}[data-user-id='${CSS.escape(user_id)}']`,
        );
    }

    get_key_from_li(opts) {
        return Number.parseInt(opts.$li.expectOne().attr("data-user-id"), 10);
    }

    get_data_from_user_ids(user_ids) {
        const data = buddy_data.get_items_for_users(user_ids);
        return data;
    }

    compare_function = buddy_data.compare_function;

    height_to_fill() {
        // Because the buddy list gets sized dynamically, we err on the side
        // of using the height of the entire viewport for deciding
        // how much content to render.  Even on tall monitors this should
        // still be a significant optimization for orgs with thousands of
        // users.
        const height = message_viewport.height();
        return height;
    }
}

export class BuddyList extends BuddyListConf {
    all_user_ids = [];
    narrow_user_ids = [];
    other_user_ids = [];

    populate(opts) {
        this.render_count = 0;
        this.$narrow_users_container.empty();
        this.narrow_user_ids = [];
        this.$other_users_container.empty();
        this.other_user_ids = [];

        // We rely on our caller to give us items
        // in already-sorted order.
        this.all_user_ids = opts.keys;

        this.fill_screen_with_content();
    }

    render_more(opts) {
        const chunk_size = opts.chunk_size;

        const begin = this.render_count;
        const end = begin + chunk_size;

        const more_user_ids = this.all_user_ids.slice(begin, end);

        if (more_user_ids.length === 0) {
            return;
        }

        const items = this.get_data_from_user_ids(more_user_ids);
        const subscribed_users = [];
        const other_users = [];
        const current_sub = narrow_state.stream_sub();
        const pm_ids_string = narrow_state.pm_ids_string();
        const pm_ids_list = pm_ids_string ? people.user_ids_string_to_ids_array(pm_ids_string) : [];
        const pm_ids_set = new Set(pm_ids_list);

        for (const item of items) {
            if (buddy_data.user_matches_narrow(item.user_id, current_sub?.stream_id, pm_ids_set)) {
                subscribed_users.push(item);
                this.narrow_user_ids.push(item.user_id);
            } else {
                other_users.push(item);
                this.other_user_ids.push(item.user_id);
            }
        }

        // Remove the empty list message before adding users
        if (
            $(`${this.narrow_container_sel} .empty-list-message`).length > 0 &&
            subscribed_users.length
        ) {
            this.$narrow_users_container.empty();
        }
        const subscribed_users_html = this.items_to_html({
            items: subscribed_users,
        });
        this.$narrow_users_container = $(this.narrow_container_sel);
        this.$narrow_users_container.append(subscribed_users_html);

        // Remove the empty list message before adding users
        if ($(`${this.other_container_sel} .empty-list-message`).length > 0 && other_users.length) {
            this.$other_users_container.empty();
        }
        const other_users_html = this.items_to_html({
            items: other_users,
        });
        this.$other_users_container = $(this.other_container_sel);
        this.$other_users_container.append(other_users_html);

        // If we have only "other users" then we don't show the headers (unless we're searching
        // from a stream/DM view).
        // Note that if we only have narrow users, we still keep the sections visible.
        const subscribed_users_is_empty =
            this.$narrow_users_container.children(".user_sidebar_entry").length === 0;
        const hide_headers = subscribed_users_is_empty && !current_sub && !pm_ids_string;
        $("#narrow-users-presence-container").toggleClass("no-display", hide_headers);
        $("#other-users-presence-container .buddy-list-subsection-header").toggleClass(
            "no-display",
            hide_headers,
        );

        // Invariant: more_user_ids.length >= items.length.
        // (Usually they're the same, but occasionally user_ids
        // won't return valid items.  Even though we don't
        // actually render these users, we still "count" them
        // as rendered.

        this.render_count += more_user_ids.length;
        this.update_padding();
    }

    get_items() {
        const $narrow_user_obj = this.$narrow_users_container.find(`${this.item_sel}`);
        const $narrow_user_elems = $narrow_user_obj.map((_i, elem) => $(elem));

        const $other_user_obj = this.$other_users_container.find(`${this.item_sel}`);
        const $other_user_elems = $other_user_obj.map((_i, elem) => $(elem));

        return [...$narrow_user_elems, ...$other_user_elems];
    }

    first_key() {
        if (this.narrow_user_ids.length) {
            return this.narrow_user_ids[0];
        }
        if (this.other_user_ids.length) {
            return this.other_user_ids[0];
        }
        return undefined;
    }

    prev_key(key) {
        let i = this.narrow_user_ids.indexOf(key);
        // This would be the middle of the narrow users list moving to a prev narrow user.
        if (i > 0) {
            return this.narrow_user_ids[i - 1];
        }
        // If it's the first narrow user, we don't move the selection.
        if (i === 0) {
            return undefined;
        }

        // This would be the middle of the other users list moving to a prev other user.
        i = this.other_user_ids.indexOf(key);
        if (i > 0) {
            return this.other_user_ids[i - 1];
        }
        // The key before the first other user is the last narrow user if that exists,
        // and if it doesn't then we don't move the selection.
        if (i === 0) {
            if (this.narrow_user_ids.length > 0) {
                return this.narrow_user_ids.at(-1);
            }
            return undefined;
        }
        // The only way we reach here is if the key isn't found in either list,
        // which shouldn't happen.
        blueslip.error("Couldn't find key in buddy list", {
            key,
            narrow_user_ids: this.narrow_user_ids,
            other_user_ids: this.other_user_ids,
        });
        return undefined;
    }

    next_key(key) {
        let i = this.narrow_user_ids.indexOf(key);
        // Moving from narrow users to other users if they exist,
        // otherwise do nothing.
        if (i >= 0 && i === this.narrow_user_ids.length - 1) {
            if (this.other_user_ids.length > 0) {
                return this.other_user_ids[0];
            }
            return undefined;
        }
        // This is a regular move within narrow users.
        if (i >= 0) {
            return this.narrow_user_ids[i + 1];
        }

        i = this.other_user_ids.indexOf(key);
        // If we're at the end of other users, we don't do anything.
        if (i >= 0 && i === this.other_user_ids.length - 1) {
            return undefined;
        }
        // This is a regular move within other users.
        if (i >= 0) {
            return this.other_user_ids[i + 1];
        }

        // The only way we reach here is if the key isn't found in either list,
        // which shouldn't happen.
        blueslip.error("Couldn't find key in buddy list", {
            key,
            narrow_user_ids: this.narrow_user_ids,
            other_user_ids: this.other_user_ids,
        });
        return undefined;
    }

    maybe_remove_key(opts) {
        let pos = this.narrow_user_ids.indexOf(opts.key);
        if (pos >= 0) {
            this.narrow_user_ids.splice(pos, 1);
        } else {
            pos = this.other_user_ids.indexOf(opts.key);
            if (pos < 0) {
                return;
            }
            this.other_user_ids.splice(pos, 1);
        }
        pos = this.all_user_ids.indexOf(opts.key);
        this.all_user_ids.splice(pos, 1);

        if (pos < this.render_count) {
            this.render_count -= 1;
            const $li = this.find_li({key: opts.key});
            $li.remove();
            this.update_padding();
        }
    }

    find_position(opts) {
        const key = opts.key;
        let i;

        const user_id_list = opts.user_id_list;

        const current_sub = narrow_state.stream_sub();
        const pm_ids_string = narrow_state.pm_ids_string();
        const pm_ids_list = pm_ids_string ? people.user_ids_string_to_ids_array(pm_ids_string) : [];
        const pm_ids_set = new Set(pm_ids_list);

        for (i = 0; i < user_id_list.length; i += 1) {
            const user_id = user_id_list[i];

            if (this.compare_function(key, user_id, current_sub, pm_ids_set) < 0) {
                return i;
            }
        }

        return user_id_list.length;
    }

    force_render(opts) {
        const pos = opts.pos;

        // Try to render a bit optimistically here.
        const cushion_size = 3;
        const chunk_size = pos + cushion_size - this.render_count;

        if (chunk_size <= 0) {
            blueslip.error("cannot show key at this position", {
                pos,
                render_count: this.render_count,
                chunk_size,
            });
        }

        this.render_more({
            chunk_size,
        });
    }

    find_li(opts) {
        const key = opts.key;

        // Try direct DOM lookup first for speed.
        let $li = this.get_li_from_key({
            key,
        });

        if ($li.length === 1) {
            return $li;
        }

        if (!opts.force_render) {
            // Most callers don't force us to render a list
            // item that wouldn't be on-screen anyway.
            return $li;
        }

        // We reference all_user_ids to see if we've rendered
        // it yet.
        const pos = this.all_user_ids.indexOf(key);

        if (pos < 0) {
            // TODO: See ListCursor.get_row() for why this is
            //       a bit janky now.
            return [];
        }

        this.force_render({
            pos,
        });

        $li = this.get_li_from_key({
            key,
        });

        return $li;
    }

    insert_new_html(opts) {
        const new_pos_in_all_users = opts.new_pos_in_all_users;
        const html = opts.html;
        const key_following_insertion = opts.key_following_insertion;
        const is_subscribed_user = opts.is_subscribed_user;

        // This means we're inserting at the end
        if (key_following_insertion === undefined) {
            if (new_pos_in_all_users === this.render_count) {
                this.render_count += 1;
                if (is_subscribed_user) {
                    this.$narrow_users_container.append(html);
                } else {
                    this.$other_users_container.append(html);
                }
                this.update_padding();
            }
            return;
        }

        if (new_pos_in_all_users < this.render_count) {
            this.render_count += 1;
            const $li = this.find_li({key: key_following_insertion});
            $li.before(html);
            this.update_padding();
        }
    }

    insert_or_move(opts) {
        const key = opts.key;
        const item = opts.item;

        this.maybe_remove_key({key});

        const new_pos_in_all_users = this.find_position({
            key,
            user_id_list: this.all_user_ids,
        });

        const current_sub = narrow_state.stream_sub();
        const pm_ids = new Set(narrow_state.pm_ids_string()?.split(","));
        const is_subscribed_user = buddy_data.user_matches_narrow(
            key,
            current_sub?.stream_id,
            pm_ids,
        );
        const user_id_list = is_subscribed_user ? this.narrow_user_ids : this.other_user_ids;
        const new_pos_in_user_list = this.find_position({
            key,
            user_id_list,
        });

        // Order is important here--get the key_following_insertion
        // before mutating our list.  An undefined value
        // corresponds to appending.
        const key_following_insertion = user_id_list[new_pos_in_user_list];

        user_id_list.splice(new_pos_in_user_list, 0, key);
        this.all_user_ids.splice(new_pos_in_all_users, 0, key);

        const html = this.item_to_html({item});
        this.insert_new_html({
            new_pos_in_all_users,
            html,
            key_following_insertion,
            is_subscribed_user,
        });
    }

    fill_screen_with_content() {
        let height = this.height_to_fill();

        const elem = scroll_util.get_scroll_element($(this.scroll_container_sel)).expectOne()[0];

        // Add a fudge factor.
        height += 10;

        while (this.render_count < this.all_user_ids.length) {
            const padding_height = $(this.padding_sel).height();
            const bottom_offset = elem.scrollHeight - elem.scrollTop - padding_height;

            if (bottom_offset > height) {
                break;
            }

            const chunk_size = 20;

            this.render_more({
                chunk_size,
            });
        }
    }

    // This is a bit of a hack to make sure we at least have
    // an empty list to start, before we get the initial payload.
    $narrow_users_container = $(this.narrow_container_sel);
    $other_users_container = $(this.other_container_sel);

    start_scroll_handler() {
        // We have our caller explicitly call this to make
        // sure everything's in place.
        const $scroll_container = scroll_util.get_scroll_element($(this.scroll_container_sel));

        $scroll_container.on("scroll", () => {
            this.fill_screen_with_content();
        });
    }

    update_padding() {
        padded_widget.update_padding({
            shown_rows: this.render_count,
            total_rows: this.all_user_ids.length,
            content_sel: this.narrow_container_sel,
            padding_sel: this.padding_sel,
        });
    }
}

export const buddy_list = new BuddyList();
