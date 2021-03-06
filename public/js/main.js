
var Trip = Parse.Object.extend("Trip");
var trip = new Trip();

var id;
var map;
var start_lat;
var start_lng;
var end_lat;
var end_lng;
var city;

var start_location;
var end_location;

var miles;
var people = 1;
var gas_type;
var price;
var mpg = 25;
var roundtrip = 1;
var cost_per;
var cost_total;

function initialize() {

    directionsService = new google.maps.DirectionsService();
    directionsDisplay = new google.maps.DirectionsRenderer();
    directionsDisplay.setMap(map);

    geocoder = new google.maps.Geocoder();

    var mapOptions = {
        zoom: 8,
        center: new google.maps.LatLng(37.714242, - 121.744868),
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById('map-canvas'),
    mapOptions);
}

google.maps.event.addDomListener(window, 'load', initialize);

function mapCurrentLocation() {
    var mapOptions = {
        zoom: 6,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map.setOptions(mapOptions);

    // Try HTML5 geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(location) {
            getCurrentLocation(location, function() {
                start_lat = location.coords.latitude;
                start_lng = location.coords.longitude;
                //console.log("resetting button");
                $("#current-location").button("reset");
                getAddress(location, function(result) {
                    $("input[name='start-location']").val(result);
                    ga('send', 'event', 'Location', 'Get Current Location', result, location.coords.latitude);
                });
                $("input[name='start-location']").addClass("input-primary");
                $("#current-location-group").addClass("info");
                $("#current-location").addClass("btn-primary");
                $("#current-location i").addClass("icon-white");
                calcRoute();
            });
        }, function() {
            handleNoGeolocation(true)
        });
        //console.log("Getting current location: lat:" + position.coords.latitude + "long:" +
        //                                 position.coords.longitude);
    }
    else {
        // Browser doesn't support Geolocation
        handleNoGeolocation(false);
    }
}

function getCurrentLocation(position, callback) {
    var pos = new google.maps.LatLng(position.coords.latitude,
    position.coords.longitude);
    
    ga('send', 'event', 'Location', 'get Current Location', "latitude", position.coords.latitude);
    ga('send', 'event', 'Location', 'get Current Location', "longitude", position.coords.longitude);
    //console.log("position.coords.latitude:"+position.coords.latitude);
    //console.log("position.coords.longitude:"+position.coords.longitude);                             
    icon = new google.maps.Marker();
    var marker = new google.maps.Marker({
        map: map,
        position: pos,
        icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
    });

    //console.log("Getting current location: lat:" + position.coords.latitude + "long:" +
    //                             position.coords.longitude);
    map.setCenter(pos);

    if (callback) {
        callback();
    }
};

function handleNoGeolocation(errorFlag) {
    var content;
    if (errorFlag) {
        content = 'Error: The Geolocation service failed.';
    }
    else {
        content = 'Error: Your browser doesn\'t support geolocation.';
    }
}

$("input[name='start-location']").focusout(function(event) {
    //event.preventDefault();
    setStart();
    ga('send', 'event', 'Location', 'setStart', $(this).val());
});

function setStart() {
    getGPS($(this).val(), function(location) {
    	ga('send', 'event', 'Location', 'setStart', $(this).val(), location.coords.latitude);
        //console.log("location");
        //console.log(location);
        start_lat = location.lat();
        start_lng = location.lng();
        calcRoute();
        var marker = new google.maps.Marker({
            map: map,
            position: location,
            icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
        });

        map.setCenter(location);
    });
}

$("input[name='end-location']").focusout(function(event) {
    //event.preventDefault();
    calcRoute();
    ga('send', 'event', 'Location', 'End Location', $(this).val());
});

$("#gas-radio .btn").click(function() {
    //console.log("gas clicked" + $(this).text());
    $("#gas-type").val($(this).val());
    ga('send', 'event', 'Calculations', 'Gas Type Changed', $(this).val(), $(this).val());
    calculateGasPrice(start_lat, start_lng, function() {
        calculateCost();
    });
});

$("#charge-friends .btn").click(function() {
    var message = $("#note").text() + " (http://gasbro.com)" 
    var user_ids = $("#venmo-friends").val();
    console.log(user_ids);
    var amount = -1*(.01);
    ga('send', 'event', 'Venmo', 'Charge Friends', message, amount);
    $.ajax({
      url: "/venmo.php",
      data: {
        call: 'payments',
        user_ids: user_ids,
        note: message,
        amount: amount,
      },
      success: function( data ) {
        $("#shareModal").append(
                "<span>" + data.status +"</span><br>" +
                "<span>" + data.action +"</span><br>" +
                "<span>" + data.message +"</span><br>" +
                "<span>" + data.balance +"</span><br>" +
                "<span>" + data.id +"</span><br>"
            );
      }
    });
});

function setSliders(){
    $("input[name='people']").slider(
        {
            min: '1',
            max: '10',
            value: '1',
            tooltip: 'show'
        }
        );
    $("input[name='mpg']").slider({
            min: '1',
            max: '100',
            value: '25',
            tooltip: 'show'
    })
}


$("input[name='people']").slider().on('slide', function(event) {
    //event.preventDefault();
    people = $(this).val();
    ga('send', 'event', 'Calculations', 'People slider changed', 'people', people);
    if ($("input[name='mpg']").val()) {
        calculateCost();
    }
    trip.save({
        people: people
    });
});

$("input[name='mpg']").slider().on('slide', function(event) {
    //event.preventDefault();
    mpg = $(this).val();
    ga('send', 'event', 'Calculations', 'People slider mpg', 'mpg', mpg);
    if ($("input[name='people']").val()) {
        calculateCost();
    }
});

$("#calculate").click(function(event) {
    event.preventDefault();
    showModal();
	ga('send', 'event', 'UI', 'Display Modal', 'modal');
});

function updateAll() {
    $("#url").val("Loading...");
    $('#shareModalHeader').html('GasBro: ' + city + ' to ' + end_location);
    calcRoute(function() {
        calculateGasPrice(start_lat, start_lng, function() {
            calculateCost(function() {
                updateHistory();
            });
        })

    });
}

function showModal() {
    $('#shareModal').modal('show');
    updateAll();
}



$("input[name='roundtrip']").on('click', function(event) {
    //event.preventDefault();
    if ($("input[name='roundtrip']:checked").length == 1) {
        roundtrip = 2;
    }
    else {
        roundtrip = 1;
    }
    calculateCost();
    ga('send', 'event', 'Calculations', 'Roundtrip clicked','roundtrip', roundtrip);
});


$("#current-location").popover({
    trigger: 'hover',
    delay: {
        show: 900,
        hide: 10
    }
});

$("#current-location").click(function() {
    $("#current-location").button("loading");
    google.maps.event.addDomListener(window, 'load', mapCurrentLocation());
});

function getGPS(address, output) {
    geocoder.geocode({
        'address': address
    }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {

            output(results[0].geometry.location);
        }
        else {
            console.log(status);
        }
    });
}

function getAddress(location, output) {
    var lat = location.coords.latitude;
    var lng = location.coords.longitude;
    geocoder.geocode({
        'address': lat + "," + lng
    }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            output(results[0].formatted_address);
        }
        else {
            console.log(status);
        }
    });
}

function calcRoute(callback) {
    start_location = $("input[name='start-location']").val();
    end_location = $("input[name='end-location']").val();
    if(start_location && end_location)
    {
	    var request = {
	        origin: start_location,
	        destination: end_location,
	        travelMode: google.maps.TravelMode.DRIVING
	    };
	    directionsService.route(request, function(response, status) {
	        //console.log("Directions response");
	        //console.log(response);
	        miles = metersToMiles(response.routes[0].legs[0].distance.value);
	        ga('send', 'event', 'Calculations', 'Calculating Route', 'miles', miles);
	        if (response.routes) {
	            start_lat = response.routes[0].legs[0].start_location.lat();
	            start_lng = response.routes[0].legs[0].start_location.lng();
	            end_lat = response.routes[0].legs[0].end_location.lat();
	            end_lng = response.routes[0].legs[0].end_location.lng();
	        }
	
	
	        if (status == google.maps.DirectionsStatus.OK) {
	            directionsDisplay.setDirections(response);
	        }
	
	        if (callback) {
	            callback();
	        }
	    });
	
	    directionsDisplay.setMap(map);
	}
}


function metersToMiles(input) {
    output = input / 1613.84193424;
    return output;
}

function calculateCost(success) {
    var errors = 1;
    if (!$("input[name='mpg']").val()) {
        errors++;
        //console.log("Error: mpgs empty");
    }
    if (!$("input[name='people']").val()) {
        errors++;
        //console.log("Error: people empty");
    }
    if (!$("input[name='start-location']").val()) {
        errors++;
        //console.log("Error: start-location empty");
    }
    if (!$("input[name='end-location']").val()) {
        errors++;
        //console.log("Error: end-location empty");
    }
    if (!price) {
        errors++;
        //console.log("Error: price empty");
    }
    if (errors == 1) {
        //setURLParameter('people',people);
        //setURLParameter('start-location',start_location);
        //setURLParameter('end-location',end_location);
        //setURLParameter('price',price);
        //setURLParameter('miles',miles);
        //setURLParameter('roundtrip',roundtrip);
        //console.log(History);
        compute();
        if (success) {
            success();
        }
    }
}

function compute() {
    cost_per = ((((miles / mpg) * price) * roundtrip) / people).toFixed(2);
    cost_total = (((miles / mpg) * price) * roundtrip).toFixed(2);
    ga('send', 'event', 'Calculations', 'Cost', 'per person', cost_per);
    ga('send', 'event', 'Calculations', 'Cost', 'total', cost_total);
    $("#cost").html("$" + cost_per);
    $("#total").html("$" + cost_total);
    $("#cost2").html("$" + cost_per);
    $("#total2").html("$" + cost_total);
    $("#num_people").html(people + " ");
    $("#num_people2").html(people + " ");

    $("#prices").slideDown();
    $("#prices2").slideDown();
}

function calculateGasPrice(lat, lng, callback) {
    gas_type = $("#gas-type").val();
    //console.log(gas_type);
    var errors = 1
    if (!lat) {
        errors++;
        //console.log("error: lat empty");
    }
    if (!lng) {
        errors++;
        //console.log("error: lng empty");
    }
    if (!gas_type) {
        errors++;
        //console.log("error: lng empty");
    }

    if (errors === 1) {
        $.ajax({
            type: 'GET',
            url: 'gas.php',
            dataType: "json",
            data: {
                latitude: lat,
                longitude: lng,
                gas_type: gas_type,
                sort_by: 'distance',
                distance: '5'

            },
            success: function(data, status, response) {
                var i = 0;

                while (data.stations[i].price == "N/A") {
                    i++;
                }


                city = data.stations[i].city
                if (data.status.error == "YES") {
                    $("#gas").html("$" + "ERROR");
                    $("#gas2").html("$" + "ERROR");
                }
                else {

                    price = data.stations[i].price;
                    
                    ga('send', 'event', 'Calculations', 'Gas Price', 'price', price);
                    $("#gas_span").html(city);
                    $("#gas_span2").html(city);
                    $("#gas").html("$" + price);
                    $("#gas2").html("$" + price);
                    $("#num_people").html(people + " ");
                    $("#num_people2").val(people);
                    $("#prices").slideDown();
                    $("#prices2").slideDown();
                }
                if (callback) {
                    callback();
                }
            },
            error: function(data) {
                console.log(data);
                $("#gas_span").html(city);
                $("#gas_span2").html(city);
                $("#gas").html("$" + "ERROR");
                $("#gas2").html("$" + "ERROR");
                if (callback) {
                    callback();
                }
            }
        });
    }
}

function getURLParameter(name) {
    return decodeURIComponent(
    (RegExp('[?|&]' + name + '=' + '(.+?)(&|$)').exec(location.search) || [null, null])[1]);
}


function updateHistory(success) {
    var errors = 1;
    if (gas_type === undefined) {

        errors++;
    }
    if (mpg === undefined) {

        errors++;
    }
    if (people === undefined) {

        errors++;
    }
    if (start_location === undefined) {

        errors++;
    }
    if (end_location === undefined) {

        errors++;
    }
    if (roundtrip === undefined) {

        errors++;
    }
    if (cost_total === undefined) {

        errors++;
    }
    if (cost_per === undefined) {

        errors++;
    }
    if (start_lat === undefined) {

        errors++;
    }
    if (start_lng === undefined) {

        errors++;
    }
    if (end_lat === undefined) {

        errors++;
    }
    if (end_lng === undefined) {

        errors++;
    }
    if (miles === undefined) {

        errors++;
    }
    if (price === undefined) {

        errors++;
    }
    if (errors == 1) {
        trip.save({
            mpg: mpg,
            gas_type: gas_type,
            people: people,
            start_location: start_location,
            end_location: end_location,
            roundtrip: roundtrip,
            cost_total: cost_total,
            cost_per: cost_per,
            start_lat: start_lat,
            start_lng: start_lng,
            end_lat: end_lat,
            end_lng: end_lng,
            miles: miles,
            price: price,
            city: city
        }, {
            success: function(result) {
                History.pushState({
                    id: result.id
                }, 'GasBro: ' + city + ' to ' + end_location, '?id=' + result.id);
                $(".logintripid").val(result.id);
                $("#url").val(document.URL);
                ga('send', 'event', 'Parse', 'Save Trip', 'tripID', result.id);
            },
            error: function(model, error) {
                $(".error").show();
            }
        });
        if (success) {
            success();
        }
    }
}

function loadTrip(id) {
    var query = new Parse.Query(Trip);
    query.get(id, {
        success: function(result) {
            // object is an instance of Parse.Object.

            $("#mpg").val(result.get("mpg"));
            $("#people").val(result.get("people"));
            $("#start").val(result.get("start_location"));
            $("#end").val(result.get("end_location"));
            $("#cost").html("$" + result.get("cost_per"));
            $("#total").html("$" + result.get("cost_total"));
            $("#gas").html("$" + result.get("price"));
            $("#gas_span").html(result.get("city"));
            $("#num_people").html(result.get("people"));

            $("#cost2").html("$" + result.get("cost_per"));
            $("#total2").html("$" + result.get("cost_total"));
            $("#gas2").html("$" + result.get("price"));
            $("#gas_span2").html(result.get("city"));
            $("#num_people2").html(result.get("people"));

            $('#shareModal').modal('show');
            $('#shareModalHeader').html('GasBro: ' + result.get("city") + ' to ' + result.get("end_location"));
            $("#prices").slideDown();
            $("#prices2").slideDown();
            $("#url").val(document.URL);

            if (result.get("roundtrip") == "2") {
                $('#roundtrip').prop('checked', true);
            }
            else {
                $('#roundtrip').prop('checked', false);
            }


            cost_total = result.get("cost_total");
            cost_per = result.get("cost_per");
            mpg = result.get("mpg");
            miles = result.get("miles");
            people = result.get("people");
            start_location = result.get("start_location");
            start_lat = result.get("start_lat");
            start_lng = result.get("start_lng");
            city = result.get("city");
            end_location = result.get("end_location");
            end_lat = result.get("end_lat");
            end_lng = result.get("end_lng");
            price = result.get("price");
            roundtrip = result.get("roundtrip");
            calcRoute();
            History.pushState({
                id: id
            }, document.title + ": " + city + " to " + end_location, '?id=' + id);
            ga('send', 'event', 'Parse', 'Load Trip', 'tripID', id);

        },

        error: function(object, error) {
            // error is an instance of Parse.Error.
            console.log("error occurred");
            ga('send', 'event', 'Parse', 'Load Trip', 'error', error);
        }

    });
}
//venmo.php?data=friends&access_token=

function getFriends(people) {
	
	ga('send', 'event', 'Venmo', 'Get Friends', 'people', people);
    $("#venmo-friends").select2({
        placeholder: "Search your Venmo Friends",
        maximumSelectionSize: people,
        multiple: true,
        ajax: {
            url: "venmo.php",
            dataType: 'json',
            quietMillis: 100,
            data: function(term, page) { // page is the one-based page number tracked by Select2
                return {
                    action: 'friends',
                    limit: 1000,
                    term: term
                };
            },
            results: function(data, page) {
                // notice we return the value of more so Select2 knows if more results can be loaded
                console.log(data);
                return {
                    results: data
                };
            }
        },
        formatResult: movieFormatResult, // omitted for brevity, see the source of this page
        formatSelection: movieFormatSelection, // omitted for brevity, see the source of this page
        dropdownCssClass: "bigdrop", // apply css that makes the dropdown taller
        escapeMarkup: function(m) {
            return m;
        } // we do not want to escape markup since we are displaying html in results
    });
}



function movieFormatResult(friend) {
    var markup = "<table class='movie-result'><tr>";
    if (friend.profile_picture_url !== undefined) {
        markup += "<td class='movie-image'><img width='50px' src='" + friend.profile_picture_url + "'/></td>";
    }
    markup += "<td class='movie-info'><div class='movie-title'>" + friend.display_name + "</div>";
    if (friend.about != "No Short Bio") {
        markup += "<div class='movie-synopsis' >" + friend.about + "</div>";
    }
    markup += "</td></tr></table>";
    return markup;
}

function movieFormatSelection(friend) {
    return friend.display_name;
}


function showIOS(){
    $('#iosModal').modal('show');
}