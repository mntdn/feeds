angular.module('feedsApp').controller('addFeedsController', function($scope, $rootScope, $http, $sce, categories) {
	$scope.nbGens = 12;
	$scope.classShow = 'hide';
	$scope.currentUser = '';
	$scope.showMessageBox = false;

	$scope.$on('open-add-feeds-dialog', function(event, args) {
		$scope.classShow = "";
		$scope.currentUser = args.userName;
		$http.get("/allFeedsList")
		.then(function(rez) {
			$scope.feeds = rez.data;
		});

		$http.get("/allCategoriesList")
		.then(function(rez) {
			rez.data.unshift({"IdCategory":-1, "Name":"None"});
			$scope.categories = rez.data;
		});
	});

	$scope.closeDialog = function() {
		$scope.classShow = 'hide';
		$rootScope.$broadcast('close-dialog');
	}

	$scope.feedTest = function(){
		$http.post("/testFeed?url="+$scope.feedToAddUrl)
			.then(function(response) {
				$scope.showMessageBox = true;
				$scope.feedError = true;
				if(response.data.err){
					$scope.errorMessage = response.data.err;
				} else {
					$scope.feedError = false;
					$scope.testNumber = response.data.nbArticles;
					$scope.testDatePublished = response.data.firstPublished;
					$scope.testTitle = response.data.firstTitle;
					$scope.testUrl = response.data.firstLink;
				}
			});
	}

	$scope.onDrop = function($event,$data, idCategory){
		console.log($data,idCategory);
		var idF = parseInt($data, 10);
		for(var i = 0; i<$scope.feeds.length; i++){
			if($scope.feeds[i].IdFeed == idF){
				$scope.feeds[i].IdCategory = idCategory;
				break;
			}
		}
	};

	$scope.addCategory = function(){
		categories.add($scope.categoryToAddName).then(function(response) {
			$scope.categories.push(response.data[0]);
		});
	}

	$scope.deleteCategory = function(IdCategory){
		categories.delete(IdCategory)
			.then(function(response) {
				var i;
				for(i = 0; i < $scope.categories.length; i++)
					if($scope.categories[i].IdCategory === IdCategory)
						break;
				console.log(i, $scope.categories[i]);
				$scope.categories.splice(i,1);
			});
	}

	$scope.addOrRemove = function(currentFeed){
		if(currentFeed.IsSubscribed === 0){
			return "plus";
		} else {
			return "minus";
		}
	}

	$scope.showFeed = function(feed){
		for(var i = 0; i < $scope.feeds.length; i++){
			if($scope.feeds[i].IdFeed === feed.IdFeed) {
				$scope.feeds[i].IsShown = !$scope.feeds[i].IsShown;
				break;
			}
		}
	}

	$scope.addFeed = function(){
		// removing everything after the #
		$scope.feedToAddUrl = $scope.feedToAddUrl.replace(/#.*/, '');
		$http.post("/testFeed?url="+$scope.feedToAddUrl)
			.then(function(response) {
				if(response.data.err){
					$scope.showMessageBox = true;
					$scope.feedError = true;
					$scope.errorMessage = response.data.err;
				} else {
					$http.post("/addFeed?Url="+$scope.feedToAddUrl+"&Name="+$scope.feedToAddName)
						.then(function(response) {
							$scope.feeds.push(response.data[0]);
						});
				}
			});
	}

	$scope.editFeed = function(feed){
		$http.post("/editFeed?IdFeed="+feed.IdFeed+"&Name="+feed.Name+"&Url="+feed.Url)
			.then(function(response) {
			})
	}

	$scope.deleteFeed = function(feed){
		$http.post("/deleteFeed?IdFeed="+feed.IdFeed)
			.then(function(response) {
				var i;
				for(i = 0; i < $scope.feeds.length; i++)
					if($scope.feeds[i].IdFeed === feed.IdFeed)
						break;
				console.log(i, $scope.feeds[i]);
				$scope.feeds.splice(i,1);
				$scope.$apply();
			});
	}

	$scope.feedChangeCategory = function(feed){
		$http.post("/changeFeedCategory?IdFeed="+feed.IdFeed+"&IdCategory="+feed.IdCategory)
			.then(function(response) {});
	}

	$scope.feedChangeSubscription = function(currentFeed) {
		if(currentFeed.IsSubscribed === 0){
			// not subscribed yet, so we begin by subscribing
			$http.post("/subscribeToFeed?IdFeed="+currentFeed.IdFeed)
				.then(function(response) {
					angular.forEach($scope.feeds, function(v, k){
						if(v.IdFeed === currentFeed.IdFeed)
							v.IsSubscribed = 1;
					});
				});
		} else {
			// already subscribed, so we unsubscribe
			$http.post("/unsubscribeFromFeed?IdFeed="+currentFeed.IdFeed)
				.then(function(response) {
					angular.forEach($scope.feeds, function(v, k){
						if(v.IdFeed === currentFeed.IdFeed)
							v.IsSubscribed = 0;
					});
				});
		}
	}
});
