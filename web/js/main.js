var app = angular.module('feedsApp', []);
app.controller('feedsController', function($scope, $document, $http, $sce) {
	$http.get("/feedsList?user=mat")
		.then(function(response) {
			$scope.feeds = response.data;
		});
		
	$http.get("/toReadLaterList?user=mat")
		.then(function(response) {
			$scope.laterContent = response.data;
		});		
		
    $document.bind("keypress", function(event) {
        // console.debug(event);
		
		if(event.code === "KeyJ"){
			if ($scope.feedContent[$scope.currentNewsId].IsRead == 0){
				// mark current item as read if not already read
				$http.post("/changeRead?user=mat&read=1&IdFC="+$scope.feedContent[$scope.currentNewsId].IdFeedContent)
					.then(function(response) {
						$scope.feedContent[$scope.currentNewsId].IsRead = 1;
						$scope.changeNbRead(-1);
						// scroll to the next news item once marked as read
						if($scope.currentNewsId < $scope.currentNewsNb - 1)
							document.getElementById('newsItem' + $scope.feedContent[++$scope.currentNewsId].IdFeedContent).scrollIntoView();				
				});				
			} else {
				// scroll to the next news item
				if($scope.currentNewsId < $scope.currentNewsNb - 1)
					document.getElementById('newsItem' + $scope.feedContent[++$scope.currentNewsId].IdFeedContent).scrollIntoView();
			}
		}
		if(event.code === "KeyK"){
			// scroll to the precedent news item
			if($scope.currentNewsId > 0)
				document.getElementById('news' + $scope.feedContent[--$scope.currentNewsId].IdFeedContent).scrollIntoView();
		}
		if(event.code === "KeyS"){
			// Starred items
			var toReadLater = {
						UniqueID: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8); return v.toString(16);}),
						Title: $scope.feedContent[$scope.currentNewsId].Title,
						Url: $sce.trustAsResourceUrl($scope.feedContent[$scope.currentNewsId].Url)
					};
			$scope.laterContent.push(toReadLater);
			$scope.$apply();
		}
		if(event.code === "KeyV"){
			// Open in new window
			window.open($scope.feedContent[$scope.currentNewsId].Url, '_blank');
		}
    });	
		
	$scope.currentNewsId = 0; // Id of the current news item shown
	$scope.currentNewsNb = 0; // Number of items in the current RSS feed
	$scope.currentFeedId = -1; // Number of items in the current RSS feed
	
	$scope.changeNbRead = function(direction){
		angular.forEach($scope.feeds, function(v, k){
			if(v.IdFeed === $scope.currentFeedId)
				v.NbItems += direction;
		});
	}
	
	$scope.getState = function(read){
		return read === 1 ? "stateOn" : "";
	}
	
	$scope.classWhenRead = function(content){
		return content.IsRead === 1 ? "read" : "";
	}
	
	$scope.postRead = function(content, toggle) {
		// if toggle = 1 then we change the read state of the news item
		var that = content;
		var finalReadState = toggle ? (content.IsRead === 1 ? 0 : 1) : 0;
		$http.post("/changeRead?user=mat&read="+finalReadState+"&IdFC="+content.IdFeedContent)
			.then(function(response) {
				that.IsRead = finalReadState;
				$scope.changeNbRead(toggle ? (finalReadState === 1 ? -1 : 1) : -1);
			});		
	};
	
	$scope.postSave = function(content, toggle) {
		// if toggle = 1 then we change the saved state of the news item
		var that = content;
		var finalSavedState = toggle ? (content.IsSaved === 1 ? 0 : 1) : 0;
		$http.post("/changeSaved?user=mat&save="+finalSavedState+"&IdFC="+content.IdFeedContent)
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
	
	$scope.feedLoad = function(idFeed){
		$http.get("/feedContent?user=mat&id="+idFeed)
			.then(function(response) {
				$scope.currentFeedId = idFeed;
				for (var i = 0; i < response.data.length; i++) {
					response.data[i].Content = $sce.trustAsHtml(response.data[i].Content);
				}
				$scope.feedContent = response.data;
				$scope.currentNewsNb = response.data.length;
			});
	}
});