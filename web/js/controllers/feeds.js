angular.module('feedsApp').controller('feedsController', function($scope, $rootScope, $window, $document, $timeout, $http, $sce) {
	$scope.currentUser = '';

	$scope.currentNewsId = 0; // Id of the current news item shown
	$scope.currentNewsNb = 0; // Number of items in the current RSS feed
	$scope.currentFeedId = -1; // Id of the current RSS feed
	$scope.nbSavedItems = 0; // number of saved items
	$scope.changeByKey = false; // true when the current item changed via a shortcut
	$scope.loggedIn = false; // not logged in by default

	$scope.autoMarkRead = true; // true to mark as read when scrolling and using shortcut keys

	$scope.errorCallback = function(r){
		console.log("erreur", r);
		$scope.loggedIn = false;
		$rootScope.$broadcast('open-login');
	}

	$scope.initFeeds = function(){
		$scope.currentNewsId = 0;
		$scope.currentNewsNb = 0;
		$scope.currentFeedId = -1;
		$scope.feedContent = [];
		$http.get("/getUsername")
			.then(function(response) {
				$scope.loggedIn = true; // first thing called, if we're here, we're logged in
				$scope.currentUser = response.data;
			}, $scope.errorCallback);
		$http.get("/feedsList")
			.then(function(response) {
				$scope.loggedIn = true; // first thing called, if we're here, we're logged in
				$scope.feeds = response.data;
			}, $scope.errorCallback);
		$http.get("/allCategoriesList")
			.then(function(rez) {
				$scope.loggedIn = true;
				rez.data.push({"IdCategory":null, "Name":"None", "ShowEmptyFeeds": 0});
				$scope.categories = rez.data;
			}, $scope.errorCallback);
		$http.get("/toReadLaterCount")
			.then(function(rez) {
				$scope.loggedIn = true;
				$scope.nbSavedItems = rez.data[0].Nb;
			}, $scope.errorCallback);
	}

	$scope.initFeeds();

	$scope.logout = function(){
		$http.get("/logout")
			.then(function(rez) {
				$scope.loggedIn = false;
				$scope.initFeeds();
			});
	}

	$scope.feedsTotal = function(catId){
		var nbTotal = 0;
		if($scope.feeds && $scope.feeds.length > 0){
			if(catId || catId === null){
				for(var i=0; i < $scope.feeds.length; i++)
					nbTotal += $scope.feeds[i].IdCategory === catId ? $scope.feeds[i].NbItems : 0;
			} else {
				for(var i=0; i < $scope.feeds.length; i++)
					nbTotal += $scope.feeds[i].NbItems;
			}
		}
		return nbTotal;
	}

	$scope.getCurrentNewsItem = function(){
		var scrollPos = document.body.scrollTop || document.documentElement.scrollTop || 0;
		var bodyRectTop = document.body.getBoundingClientRect().top;
		var newsList = document.getElementsByClassName("newsItem");
		var finalId = "";
		for(var i = 0; i < newsList.length; i++) {
			var currentRect = newsList[i].getBoundingClientRect();
			// we're not on anything yet
			if(scrollPos < currentRect.top)
				break;
			if(currentRect.bottom < 0) // element outside of the screen -> next one !
				continue;
			// the first element on screen is the good one !
			finalId = newsList[i].getAttribute("data-id-feed");
			break;
		}
		return finalId === "" ? null : parseInt(finalId, 10);
	}

	$window.onscroll = function(e) {
		if($scope.activateMainClass === ""){
			var currentId = $scope.getCurrentNewsItem();
			if(currentId !== null && !$scope.changeByKey){
				var j = 0;
				for(; j < $scope.feedContent.length; j++){
					if($scope.feedContent[j].IdFeedContent === currentId)
						break;
				}
				$scope.currentNewsId = j;
				$scope.$apply();
				if ($scope.autoMarkRead && $scope.feedContent[j].IsRead == 0){
					$scope.feedContent[j].IsRead = 1;
					$scope.changeNbRead(-1);
					// mark current item as read if not already read
					$http.post("/changeRead?read=1&IdFC="+$scope.feedContent[j].IdFeedContent)
						.then(function(response) { });
				}
			}
			$scope.changeByKey = false;
		} else {
			return false;
		}
	};

    $document.bind("keypress", function(event) {
		// listening to events only if not in configuration mode
		if($scope.activateMainClass === ""){
			if(event.shiftKey && event.code === "KeyJ"){
				// SHIFT+J ---> next feed with unread items
				var reload = false;
				if($scope.currentFeedId === -1 && $scope.feeds.length > 0){
					$scope.currentFeedId = $scope.feeds[0].IdFeed;
					reload = true;
				}
				else if($scope.feeds.length > 0){
					var i=0;
					for(;i<$scope.feeds.length; i++)
						if($scope.feeds[i].IdFeed === $scope.currentFeedId)
							break;
					if(i !== $scope.feeds.length - 1){
						i++;
						for(;i<$scope.feeds.length; i++){
							if($scope.feeds[i].NbItems > 0){
								$scope.currentFeedId = $scope.feeds[i].IdFeed;
								reload = true;
								break;
							}
						}
					}
				}
				if($scope.currentFeedId !== -1 && reload)
					$scope.feedLoad($scope.currentFeedId, true);
			}
			if(event.shiftKey && event.code === "KeyK"){
				// SHIFT+K ---> previous feed with unread items
				var reload = false;
				if($scope.currentFeedId !== -1){
					if($scope.feeds.length > 0){
						var i=0;
						for(;i<$scope.feeds.length; i++)
							if($scope.feeds[i].IdFeed === $scope.currentFeedId)
								break;
						if(i > 0){
							$scope.currentFeedId = $scope.feeds[i-1].IdFeed;
							reload = true;
						}
					}
				}
				if(reload)
					$scope.feedLoad($scope.currentFeedId, true);
			}
			if(!event.shiftKey && event.code === "KeyJ"){
				// J ---> next item
				if($scope.feedContent.length > 0){
					$scope.changeByKey = true;
					if ($scope.autoMarkRead && $scope.feedContent[$scope.currentNewsId].IsRead == 0){
						// mark current item as read if not already read
						$scope.feedContent[$scope.currentNewsId].IsRead = 1;
						// scroll to the next news item once marked as read
						if($scope.currentNewsId < $scope.currentNewsNb - 1){
							$scope.currentNewsId++;
							document.getElementById('newsItem' + $scope.feedContent[$scope.currentNewsId].IdFeedContent).scrollIntoView();
						}
						$scope.changeNbRead(-1);
						// effectively mark it as read
						$http.post("/changeRead?user="+$scope.currentUser+"&read=1&IdFC="+$scope.feedContent[$scope.currentNewsId].IdFeedContent)
							.then(function(response) { });
					} else {
						// scroll to the next news item
						if($scope.currentNewsId < $scope.currentNewsNb - 1){
							$scope.currentNewsId++;
							document.getElementById('newsItem' + $scope.feedContent[$scope.currentNewsId].IdFeedContent).scrollIntoView();
						}
					}
				}
			}
			if(!event.shiftKey && event.code === "KeyK"){
				// K ---> previous item
				if($scope.feedContent.length > 0){
					// scroll to the precedent news item
					if($scope.currentNewsId > 0){
						$scope.currentNewsId--;
						document.getElementById('news' + $scope.feedContent[$scope.currentNewsId].IdFeedContent).scrollIntoView();
					}
				}
			}
			if(event.code === "KeyS"){
				// S ---> toggle saving of an item
				$scope.postToggleSave($scope.feedContent[$scope.currentNewsId]);
			}
			if(event.code === "KeyV"){
				// V ---> Open current item's link in new window
				window.open($scope.feedContent[$scope.currentNewsId].Url, '_blank');
			}
		}
    });

	$scope.activateMainClass = "";

	$scope.changeNbRead = function(direction){
		angular.forEach($scope.feeds, function(v, k){
			if(v.IdFeed === $scope.currentFeedId)
				v.NbItems += direction;
		});
		if($scope.currentNewsId >= $scope.feedContent.length - 3){
			$scope.feedLoad($scope.currentFeedId, false);
		}
	}

	$scope.toggleShowAll = function(IdCategory){
		angular.forEach($scope.categories, function(v, i){
			if(v.IdCategory === IdCategory)
				v.ShowEmptyFeeds = v.ShowEmptyFeeds === 0 ? -1 : 0;
		});
	}

	$scope.openDialog = function(){
		$scope.activateMainClass = "disableInput";
		$rootScope.$broadcast('open-dialog', {userName:$scope.currentUser});
	}

    $scope.openAddFeedsDialog = function(){
		$scope.activateMainClass = "disableInput";
		$rootScope.$broadcast('open-add-feeds-dialog', {userName:$scope.currentUser});
	}

	$scope.openCategoriesDialog = function(){
		$scope.activateMainClass = "disableInput";
		$rootScope.$broadcast('open-categories-dialog', {userName:$scope.currentUser});
	}

	$scope.getState = function(read){
		return read === 1 ? "" : "-o";
	}

	$scope.getStateRead = function(read){
		return read ? 'fa-check-square-o' : 'fa-square-o';
	}

	$scope.getItemClass = function(content){
		var finalClass = [];
		finalClass.push(content.IsRead === 1 ? "read" : "");
		finalClass.push(content.IdFeedContent === $scope.feedContent[$scope.currentNewsId].IdFeedContent ? "currentItem" : "");

		return finalClass.join(" ");
	}

	$scope.sortByNewest = function(){
		for(var i = 0; i < $scope.feeds.length; i++){
			if($scope.feeds[i].IdFeed === $scope.currentFeedId)
				return $scope.feeds[i].NewestFirst === 1;
		}
		return true;
	}

	$scope.changeSortOrder = function(){
		$http.post("/changeFeedSortOrder?IdFeed="+$scope.currentFeedId).then(function(response) {});
		for(var i = 0; i < $scope.feeds.length; i++){
			if($scope.feeds[i].IdFeed === $scope.currentFeedId){
				$scope.feeds[i].NewestFirst = $scope.feeds[i].NewestFirst === 1 ? 0 : 1;
				break;
			}
		}
		$scope.feedLoad($scope.currentFeedId, true);
	}

	$scope.postRead = function(content, toggle) {
		// if toggle = 1 then we change the read state of the news item
		var that = content;
		var finalReadState = toggle ? (content.IsRead === 1 ? 0 : 1) : 0;
		$http.post("/changeRead?read="+finalReadState+"&IdFC="+content.IdFeedContent)
			.then(function(response) {
				that.IsRead = finalReadState;
				$scope.changeNbRead(toggle ? (finalReadState === 1 ? -1 : 1) : -1);
			});
	};

	$scope.loadSaved = function(){
		$http.get("/toReadLaterList")
			.then(function(response) {
				for (var i = 0; i < response.data.length; i++) {
					response.data[i].Content = $sce.trustAsHtml(response.data[i].Content);
				}
				$scope.feedContent = response.data;
			});
	}

	$scope.postToggleSave = function(content) {
		$scope.nbSavedItems += content.IsSaved === 1 ? -1 : 1;
		content.IsSaved = content.IsSaved === 1 ? 0 : 1;
		$http.post("/changeSaved?save="+content.IsSaved+"&IdFC="+content.IdFeedContent)
		.then(function(response) {});
	};

	$scope.showHeader = function() {
		if(typeof($scope.feedContent) === 'undefined')
			return false;
		else
			return $scope.feedContent.length > 0;
	}

	$scope.readAll = function(){
		$http.post("/markAllRead?IdFeed="+$scope.currentFeedId)
			.then(function(response) {
				angular.forEach($scope.feedContent, function(v, k){
					if(v.IsRead == 0) {
						// it was unread, we mark it as read and we decrease the nb of items unread
						v.IsRead = 1;
					}
				});
				for(var i = 0; i < $scope.feeds.length; i++){
					if($scope.feeds[i].IdFeed === $scope.currentFeedId){
						$scope.feeds[i].NbItems = 0;
						break;
					}
				}
			});
	}

	$scope.feedLoad = function(idFeed, initial){
		var direction = "DESC";
		for(var i = 0; i < $scope.feeds.length; i++){
			if($scope.feeds[i].IdFeed === idFeed){
				direction = $scope.feeds[i].NewestFirst === 1 ? "DESC" : "ASC";
				break;
			}
		}
		$http.get("/feedContent?id="+idFeed+"&direction="+direction)
			.then(function(response) {
				$scope.currentFeedId = idFeed;
				for (var i = 0; i < response.data.length; i++) {
					response.data[i].Content = $sce.trustAsHtml(response.data[i].Content);
				}
				if(initial){
					// first load of this feed
					$scope.feedContent = response.data;
					$scope.currentNewsNb = response.data.length;
					$scope.currentNewsId = 0;
					window.scrollTo(0,0);
				} else {
					// we're scrolling through the feed
					// let's add all the new items fetched from the DB
					for(var i = 0; i < response.data.length; i++){
						var found = false;
						for(var j=0; j < $scope.feedContent.length; j++){
							if($scope.feedContent[j].IdFeedContent === response.data[i].IdFeedContent){
								found = true;
								break;
							}
						}
						if(!found){
							$scope.feedContent.push(response.data[i]);
							$scope.currentNewsNb++;
						}
					}
				}
			});
	}

	$scope.$on('close-dialog', function(event, args) {
		$scope.activateMainClass = "";
		$scope.classShow = "";
		$scope.initFeeds();
	});

	$scope.$on('login', function(event, args) {
		// console.log(args);
		// $scope.currentUser = args.user;
		$scope.activateMainClass = "";
		$scope.classShow = "";
		$scope.initFeeds();
	});
});
