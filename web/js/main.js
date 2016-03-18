var app = angular.module('feedsApp', []);
app.controller('feedsController', function($scope, $rootScope, $document, $timeout, $http, $sce) {
	$scope.currentUser = 'mat';
	
	$http.get("/feedsList?user="+$scope.currentUser)
		.then(function(response) {
			$scope.feeds = response.data;
		});
		
	$http.get("/toReadLaterList?user="+$scope.currentUser)
		.then(function(response) {
			$scope.laterContent = response.data;
		});		
		
    $document.bind("keypress", function(event) {
		// we're going to modify the $scope, so let's wrap this in $apply
		$scope.$apply(function(){
			if(event.code === "KeyJ"){
				if ($scope.feedContent[$scope.currentNewsId].IsRead == 0){
					// mark current item as read if not already read
					$http.post("/changeRead?user="+$scope.currentUser+"&read=1&IdFC="+$scope.feedContent[$scope.currentNewsId].IdFeedContent)
						.then(function(response) {
							$scope.feedContent[$scope.currentNewsId].IsRead = 1;
							$scope.changeNbRead(-1);
							// scroll to the next news item once marked as read
							if($scope.currentNewsId < $scope.currentNewsNb - 1){
								$scope.currentNewsId++;
								document.getElementById('newsItem' + $scope.feedContent[$scope.currentNewsId].IdFeedContent).scrollIntoView();							
							}
					});				
				} else {
					// scroll to the next news item
					if($scope.currentNewsId < $scope.currentNewsNb - 1){
						$scope.currentNewsId++;
						document.getElementById('newsItem' + $scope.feedContent[$scope.currentNewsId].IdFeedContent).scrollIntoView();					
					}
				}
			}
			if(event.code === "KeyK"){
				// scroll to the precedent news item
				if($scope.currentNewsId > 0){
					$scope.currentNewsId--;
					document.getElementById('news' + $scope.feedContent[$scope.currentNewsId].IdFeedContent).scrollIntoView();				
				}
			}
			if(event.code === "KeyS"){
				// Starred items
				var toReadLater = {
							UniqueID: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8); return v.toString(16);}),
							Title: $scope.feedContent[$scope.currentNewsId].Title,
							Url: $sce.trustAsResourceUrl($scope.feedContent[$scope.currentNewsId].Url)
						};
				$scope.laterContent.push(toReadLater);
			}
			if(event.code === "KeyV"){
				// Open in new window
				window.open($scope.feedContent[$scope.currentNewsId].Url, '_blank');
			}			
		});
    });	
	
	$scope.currentNewsId = 0; // Id of the current news item shown
	$scope.currentNewsNb = 0; // Number of items in the current RSS feed
	$scope.currentFeedId = -1; // Id of the current RSS feed
	
	$scope.activateMainClass = "";
	
	$scope.changeNbRead = function(direction){
		angular.forEach($scope.feeds, function(v, k){
			if(v.IdFeed === $scope.currentFeedId)
				v.NbItems += direction;
		});
	}
	
	$scope.openDialog = function(){
		$scope.activateMainClass = "disableInput";
		$rootScope.$broadcast('open-dialog', {userName:$scope.currentUser});
	}
	
	$scope.getState = function(read){
		return read === 1 ? "" : "-o";
	}
	
	$scope.classWhenRead = function(content){
		return content.IsRead === 1 ? "read" : "";
	}
	
	$scope.classWhenActive = function(content){
		return content.IdFeedContent === $scope.feedContent[$scope.currentNewsId].IdFeedContent ? "currentItem" : "";
	}
	
	$scope.postRead = function(content, toggle) {
		// if toggle = 1 then we change the read state of the news item
		var that = content;
		var finalReadState = toggle ? (content.IsRead === 1 ? 0 : 1) : 0;
		$http.post("/changeRead?user="+$scope.currentUser+"&read="+finalReadState+"&IdFC="+content.IdFeedContent)
			.then(function(response) {
				that.IsRead = finalReadState;
				$scope.changeNbRead(toggle ? (finalReadState === 1 ? -1 : 1) : -1);
			});		
	};
	
	$scope.postSave = function(content, toggle) {
		// if toggle = 1 then we change the saved state of the news item
		var that = content;
		var finalSavedState = toggle ? (content.IsSaved === 1 ? 0 : 1) : 0;
		$http.post("/changeSaved?user="+$scope.currentUser+"&save="+finalSavedState+"&IdFC="+content.IdFeedContent)
			.then(function(response) {
				that.IsSaved = finalSavedState;
				if(toggle && finalSavedState === 0){
					// if we "unsaved" an item, we have to remove it from the list
					var posToDelete = -1;
					for(var i = 0; i < $scope.laterContent.length; i++){
						if($scope.laterContent[i].IdFeedContent === that.IdFeedContent){
							posToDelete = i;
							break;
						}
					}
					if (posToDelete >= 0)
						$scope.laterContent.splice(posToDelete,1);
				} else if(toggle && finalSavedState === 1){
					$scope.laterContent.push(that);
				}
			});		
	};
	
	$scope.showHeader = function() {
		if(typeof($scope.feedContent) === 'undefined')
			return false;
		else
			return $scope.feedContent.length > 0;
	}
	
	$scope.readAll = function(){
		$http.post("/markAllRead?user="+$scope.currentUser+"&IdFeed="+$scope.currentFeedId)
			.then(function(response) {
				angular.forEach($scope.feedContent, function(v, k){
					if(v.IsRead == 0) {
						// it was unread, we mark it as read and we decrease the nb of items unread
						v.IsRead = 1;
						angular.forEach($scope.feeds, function(vf, kf){
							if(vf.IdFeed === $scope.currentFeedId)
								vf.NbItems -= 1;
						});
					}
				});
			});		
	}
	
	$scope.unreadAll = function(){
		$http.post("/markAllUnread?user="+$scope.currentUser+"&IdFeed="+$scope.currentFeedId)
			.then(function(response) {
				angular.forEach($scope.feedContent, function(v, k){
					if(v.IsRead == 1) {
						// it was read, we mark it as unread and we increase the nb of items unread
						v.IsRead = 0;
						angular.forEach($scope.feeds, function(vf, kf){
							if(vf.IdFeed === $scope.currentFeedId)
								vf.NbItems += 1;
						});
					}
				});
			});		
	}
	
	$scope.feedLoad = function(idFeed){
		$http.get("/feedContent?user="+$scope.currentUser+"&id="+idFeed)
			.then(function(response) {
				$scope.currentFeedId = idFeed;
				for (var i = 0; i < response.data.length; i++) {
					response.data[i].Content = $sce.trustAsHtml(response.data[i].Content);
				}
				$scope.feedContent = response.data;
				$scope.currentNewsNb = response.data.length;
				$scope.currentNewsId = 0;
				window.scrollTo(0,0)
				// let's wait for the DOM drawing phase to have taken place
				// $timeout(function(){
					// document.getElementById('newsItem' + $scope.feedContent[$scope.currentNewsId].IdFeedContent).scrollIntoView()
				// });  
			});
	}
	
	$scope.$on('close-dialog', function(event, args) {
		$scope.activateMainClass = "";
		$scope.classShow = "";
	});
});

app.controller('setupController', function($scope, $rootScope, $http, $sce) {
	$scope.nbGens = 12;
	$scope.classShow = 'hide';
	$scope.currentUser = '';
	$scope.$on('open-dialog', function(event, args) {
		$scope.classShow = "";
		$scope.currentUser = args.userName;
		$http.get("/allFeedsList?user="+$scope.currentUser)
			.then(function(response) {
				$scope.feeds = response.data;
			});
	});
		
	$scope.closeDialog = function() {
		$scope.classShow = 'hide';
		$rootScope.$broadcast('close-dialog');
	}
	
	$scope.addOrRemove = function(currentFeed){
		if(currentFeed.IsSubscribed === 0){
			return "plus";
		} else {
			return "minus";			
		}
	}
	
	$scope.feedChangeSubscription = function(currentFeed) {		
		if(currentFeed.IsSubscribed === 0){
			// not subscribed yet, so we begin by subscribing
			$http.post("/subscribeToFeed?user="+$scope.currentUser+"&IdFeed="+currentFeed.IdFeed)
				.then(function(response) {
					angular.forEach($scope.feeds, function(v, k){
						if(v.IdFeed === currentFeed.IdFeed)
							v.IsSubscribed = 1;
					});
				});
		} else {
			// already subscribed, so we unsubscribe
			$http.post("/unsubscribeFromFeed?user="+$scope.currentUser+"&IdFeed="+currentFeed.IdFeed)
				.then(function(response) {
					angular.forEach($scope.feeds, function(v, k){
						if(v.IdFeed === currentFeed.IdFeed)
							v.IsSubscribed = 0;
					});
				});		
		}
	}
});
