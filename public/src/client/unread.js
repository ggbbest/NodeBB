'use strict';


define('forum/unread', [
	'topicSelect', 'components', 'topicList', 'categorySelector', 'alerts',
], function (topicSelect, components, topicList, categorySelector, alerts) {
	const Unread = {};

	const watchStates = {
		ignoring: 1,
		notwatching: 2,
		watching: 3,
	};

	Unread.init = function () {
		app.enterRoom('unread_topics');

		handleMarkRead();

		topicList.init('unread');

		updateUnreadTopicCount('/' + ajaxify.data.selectedFilter.url, ajaxify.data.topicCount);
	};

	function handleMarkRead() {
		function markAllRead() {
			socket.emit('topics.markAllRead', function (err) {
				if (err) {
					return alerts.error(err);
				}

				alerts.success('[[unread:topics_marked_as_read.success]]');

				$('[component="category"]').empty();
				$('[component="pagination"]').addClass('hidden');
				$('#category-no-topics').removeClass('hidden');
				$('.markread').addClass('hidden');
			});
		}

		function markSelectedRead() {
			const tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return;
			}
			socket.emit('topics.markAsRead', tids, function (err) {
				if (err) {
					return alerts.error(err);
				}

				doneRemovingTids(tids);
			});
		}

		function markCategoryRead(cid) {
			function getCategoryTids(cid) {
				const tids = [];
				components.get('category/topic', 'cid', cid).each(function () {
					tids.push($(this).attr('data-tid'));
				});
				return tids;
			}
			const tids = getCategoryTids(cid);

			socket.emit('topics.markCategoryTopicsRead', cid, function (err) {
				if (err) {
					return alerts.error(err);
				}

				doneRemovingTids(tids);
			});
		}

		const selector = categorySelector.init($('[component="category-selector"]'), {
			onSelect: function (category) {
				selector.selectCategory(0);
				if (category.cid === 'all') {
					markAllRead();
				} else if (category.cid === 'selected') {
					markSelectedRead();
				} else if (parseInt(category.cid, 10) > 0) {
					markCategoryRead(category.cid);
				}
			},
			selectCategoryLabel: ajaxify.data.selectCategoryLabel || '[[unread:mark_as_read]]',
			localCategories: [
				{
					cid: 'selected',
					name: '[[unread:selected]]',
					icon: '',
				},
				{
					cid: 'all',
					name: '[[unread:all]]',
					icon: '',
				},
			],
		});
	}

	function doneRemovingTids(tids) {
		removeTids(tids);

		alerts.success('[[unread:topics_marked_as_read.success]]');

		if (!$('[component="category"]').children().length) {
			$('#category-no-topics').removeClass('hidden');
			$('.markread').addClass('hidden');
		}
	}

	function removeTids(tids) {
		for (let i = 0; i < tids.length; i += 1) {
			components.get('category/topic', 'tid', tids[i]).remove();
		}
	}

	function updateUnreadTopicCount(url, count) {
		if (!utils.isNumber(count)) {
			return;
		}

		$('a[href="' + config.relative_path + url + '"].navigation-link i')
			.toggleClass('unread-count', count > 0)
			.attr('data-content', count > 99 ? '99+' : count);
	}

	Unread.initUnreadTopics = function () {
		const unreadTopics = app.user.unreadData;

		function onNewPost(data) {
			if (data && data.posts && data.posts.length && unreadTopics) {
				const post = data.posts[0];
				if (parseInt(post.uid, 10) === parseInt(app.user.uid, 10) ||
					(!post.topic.isFollowing && post.categoryWatchState !== watchStates.watching)
				) {
					return;
				}

				const tid = post.topic.tid;
				if (!unreadTopics[''][tid] || !unreadTopics.new[tid] ||
					!unreadTopics.watched[tid] || !unreadTopics.unreplied[tid]) {
					markTopicsUnread(tid);
				}

				if (!unreadTopics[''][tid]) {
					increaseUnreadCount('');
					unreadTopics[''][tid] = true;
				}
				const isNewTopic = post.isMain && parseInt(post.uid, 10) !== parseInt(app.user.uid, 10);
				if (isNewTopic && !unreadTopics.new[tid]) {
					increaseUnreadCount('new');
					unreadTopics.new[tid] = true;
				}
				const isUnreplied = parseInt(post.topic.postcount, 10) <= 1;
				if (isUnreplied && !unreadTopics.unreplied[tid]) {
					increaseUnreadCount('unreplied');
					unreadTopics.unreplied[tid] = true;
				}

				if (post.topic.isFollowing && !unreadTopics.watched[tid]) {
					increaseUnreadCount('watched');
					unreadTopics.watched[tid] = true;
				}
			}
		}

		function increaseUnreadCount(filter) {
			const unreadUrl = '/unread' + (filter ? '?filter=' + filter : '');
			const newCount = 1 + parseInt($('a[href="' + config.relative_path + unreadUrl + '"].navigation-link i').attr('data-content'), 10);
			updateUnreadTopicCount(unreadUrl, newCount);
		}

		function markTopicsUnread(tid) {
			$('[data-tid="' + tid + '"]').addClass('unread');
		}

		$(window).on('action:ajaxify.end', function () {
			if (ajaxify.data.template.topic) {
				['', 'new', 'watched', 'unreplied'].forEach(function (filter) {
					delete unreadTopics[filter][ajaxify.data.tid];
				});
			}
		});
		socket.removeListener('event:new_post', onNewPost);
		socket.on('event:new_post', onNewPost);

		socket.removeListener('event:unread.updateCount', updateUnreadCounters);
		socket.on('event:unread.updateCount', updateUnreadCounters);
	};

	function updateUnreadCounters(data) {
		updateUnreadTopicCount('/unread', data.unreadTopicCount);
		updateUnreadTopicCount('/unread?filter=new', data.unreadNewTopicCount);
		updateUnreadTopicCount('/unread?filter=watched', data.unreadWatchedTopicCount);
		updateUnreadTopicCount('/unread?filter=unreplied', data.unreadUnrepliedTopicCount);
	}

	return Unread;
});
