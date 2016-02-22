var app = angular.module('feedsApp', []);
app.controller('feedsController', function($scope, $document, $http, $sce) {
	$http.get("/feedsList")
		.then(function(response) {
			$scope.feeds = response.data;
		});
		
    $document.bind("keypress", function(event) {
        // console.debug(event);
		
		if(event.code === "KeyJ"){
			// scroll to the next news item
			if($scope.currentNewsId < $scope.currentNewsNb - 1)
				document.getElementById('news' + ++$scope.currentNewsId).scrollIntoView();
			else{
				console.debug("Toot much");
			}
		}
		if(event.code === "KeyK"){
			// scroll to the precedent news item
			if($scope.currentNewsId > 0)
				document.getElementById('news' + --$scope.currentNewsId).scrollIntoView();
		}
		if(event.code === "KeyV"){
			// open current item in new background window
			var toReadLater = {
						UniqueID: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8); return v.toString(16);}),
						Title: $scope.feedContent[$scope.currentNewsId].Title,
						Url: $sce.trustAsResourceUrl($scope.feedContent[$scope.currentNewsId].Url)
					};
			$scope.laterContent.push(toReadLater);
			$scope.$apply();
		}
    });	
	
	$scope.laterContent = [];
	
	$scope.currentNewsId = 0; // Id of the current news item shown
	$scope.currentNewsNb = 0; // Number of items in the current RSS feed
	
	$scope.feedLoad = function(idFeed){
		$http.get("/feedContent?id="+idFeed)
			.then(function(response) {
				for (var i = 0; i < response.data.length; i++) {
					response.data[i].Content = $sce.trustAsHtml(response.data[i].Content);
					response.data[i].UniqueID = i;
				}
				$scope.feedContent = response.data;
				$scope.currentNewsNb = response.data.length;
			});
	}
});