import os

import pandas as pd
import numpy as np
import datetime
from dateutil.parser import parse


import sqlalchemy
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.orm import Session
from sqlalchemy import create_engine

from flask import Flask, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy


from werkzeug.routing import BaseConverter

class ListConverter(BaseConverter):

    def to_python(self, value):
        return value.split('+')

    def to_url(self, values):
        return '+'.join(BaseConverter.to_url(value)
                        for value in values)

app = Flask(__name__)

app.url_map.converters['list'] = ListConverter

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///static/db/snowemergency.sqlite"
db = SQLAlchemy(app)

# reflect an existing database into a new model
Base = automap_base()
# reflect the tables
Base.prepare(db.engine, reflect=True)

# Save references to each table
Parking = Base.classes.parking
Towing = Base.classes.towing
Snowfall = Base.classes.snowfall
Episode = Base.classes.episodes
Bsnowfall = Base.classes.bsnowfall


@app.route("/testing/<list:variable_args>")
def testing(variable_args):
    print(variable_args)
    for variable in variable_args:
        print(variable)
    return jsonify(variable_args)

"""
The following functions are used to compute a geoJSON of Voronoi polygons of snowfall amounts over the 
Twin Cities Metro area.
"""
METROCOUNTIES = ['HENNEPIN', 'RAMSEY', 'ANOKA', 'CARVER', 'DAKOTA', 'SCOTT', 'WRIGHT', 'SHERBURNE', 'ISANTI',\
                'WASHINGTON', 'CHISAGO']

def filter_by_dates(df, start_date, end_date, counties=METROCOUNTIES):
    """For each station, return the cumulative snowfall from start_date to end_date, inclusive"""
    
    #print("filtering")

    number_of_days = (end_date - start_date).days + 1 # since inclusive

    range_of_days = [start_date + datetime.timedelta(days=day) for day in range(number_of_days)]
    #print(range_of_days)

    #print("type of date", df.loc[1,'date'])

    df['date'] = [parse(date) for date in df['date']]

    #print("type of date", df.loc[1,'date'])
    
    time_cond = df['date'].isin(range_of_days)
    print("time cond", time_cond.any())

    county_cond = df['county'].isin(counties)
    #print("county_cond", county_cond.any())

    combined_cond = time_cond & county_cond
    #print("combined_cond", combined_cond.any())

    result = df[combined_cond]

    return result

def group_and_summarize_dataframe (df, grouping, stats):      
    # Create an empty dataframe to store the results.
    results_df = pd.DataFrame()
    grouped_df = df.groupby(grouping)
    for name, column, agg_func in stats:
        results_df[name] = grouped_df[column].agg(agg_func)
        
    return results_df.reset_index()

def metro_snowtotals_by_dates(df, start_date, end_date):    
    # print("metro_snowtotals_by_dates______________________________________")
    # print(start_date)
    # print(end_date)

    filtered_df = filter_by_dates(df, start_date, end_date)
    # print(filtered_df)

    total_df = group_and_summarize_dataframe(filtered_df, 'station',\
                                           [('name', 'name', lambda x: x.unique()),\
                                            ('county', 'county', lambda x: x.unique()),\
                                            ('longitude', 'longitude', lambda x: x.unique()),\
                                            ('latitude', 'latitude',  lambda x: x.unique()),\
                                            ('snowtotal', 'snowfall', 'sum')])
    # print(total_df)

    return total_df


def msp_snowtotals_by_dates(df, start_date, end_date):
    print("In MSP snowtotals")
    msp_df = df[df['station'] == 'USW00014922']
    filtered_df = filter_by_dates(msp_df, start_date, end_date)

    return sum(filtered_df['snowfall'])

# The code below was not mine - the source is given below
# https://geoffboeing.com/2015/10/exporting-python-data-geojson/

def df_to_geojson(df, properties, lat='latitude', lon='longitude'):
    # print(df)
    geojson = {'type':'FeatureCollection', 'features':[]}
    for _, row in df.iterrows():
        feature = {'type':'Feature',
                   'properties':{},
                   'geometry':{'type':'Point',
                               'coordinates':[]}}
        feature['geometry']['coordinates'] = [row[lon],row[lat]]
        for prop in properties:
            feature['properties'][prop] = row[prop]
        geojson['features'].append(feature)

    # print(geojson)

    return jsonify(geojson)

"""
My code for constructing a choropleth
"""
def make_geojson_from_bins (bin_counts, xedges, yedges):
    
    def make_polygon_coords (xcenter, ycenter, xdelta, ydelta):
        return [[
            [xcenter - xdelta, ycenter - ydelta],
            [xcenter + xdelta, ycenter - ydelta],
            [xcenter + xdelta, ycenter + ydelta],
            [xcenter - xdelta, ycenter + ydelta],
            [xcenter - xdelta, ycenter - ydelta]
        ]]
    """
    Using the output from numpy.histogram2d, create a geoJSON with geometry features of Polygons
    and properties features of the bin_counts.  This is used to create a gridded choropleth with 
    finer detail.
    """
    m = len(bin_counts)
    n = len(bin_counts[0])
    xcenter = (xedges[:-1] + xedges[1:]) / 2
    ycenter = (yedges[:-1] + yedges[1:]) / 2
    x_delta = xcenter[0] - xedges[0]
    y_delta = ycenter[0] - yedges[0]
    
    features = []
    for j in range(n):
        for i in range(m):
            poly = make_polygon_coords(xcenter[i], ycenter[j], x_delta, y_delta)
            bincount = bin_counts[j, i]
            
            feature = {"type": "Feature",
                      "properties": {
                          "count": bincount
                      },
                      "geometry": {
                          "type": "Polygon",
                          "coordinates": poly
                      }}
            features.append(feature)
            
            # print(feature)
    feature_collection = {
        "type": "FeatureCollection",
        "features": features
    }
    return feature_collection

def make_choropleth_geojson(lon, lat, bins):
    """
    bins can be any form that np.histogram2d accepts as a bins argument.
    """
    H, xedges, yedges = np.histogram2d(lon, lat, bins=bins)
    H = H.T
    return make_geojson_from_bins(H, xedges, yedges)


"""
App routes for individual html pages.
"""
@app.route("/")
def index():
    """Return the homepage."""
    return render_template("index.html")

@app.route("/snowfall")
def snowfall():
    """Return the homepage."""
    return render_template("snowfall.html")

@app.route("/days")
def days():
    """Return the homepage."""
    return render_template("days.html")

@app.route("/communities")
def communities():
    """Return the homepage."""
    return render_template("communities.html")

@app.route("/emergencies")
def emergencies():
    """Return the homepage."""
    return render_template("emergencies.html")

@app.route("/background")
def background():
    """Return the homepage."""
    return render_template("background.html")

@app.route("/credits")
def credits():
    """Return the homepage."""
    return render_template("credits.html")


"""
App routes 
"""
@app.route("/towing_choropleth/<list:choropleth_args>")
def towing_choropleth(choropleth_args):
    name = choropleth_args[0]
    what = choropleth_args[1]

    if what == 'tows':
        stmt = db.session.query(Towing).statement
    else:
        stmt = db.session.query(Parking).statement

    df = pd.read_sql_query(stmt, db.session.bind)

    emergency_df = df[ df['emergency'] == name ]

    choropleth = make_choropleth_geojson(emergency_df.longitude, emergency_df.latitude, 50)

    return jsonify(choropleth)

@app.route("/snowfall_summary")
def snowfall_summary():
    stmt = db.session.query(Episode).statement
    emergency_df = pd.read_sql_query(stmt, db.session.bind)
    # print(df)
    
    # print(emergency_df)

    stmt = db.session.query(Bsnowfall).statement
    snow_df = pd.read_sql_query(stmt, db.session.bind)

    stmt = db.session.query(Towing).statement
    tows = pd.read_sql_query(stmt, db.session.bind)

    tows_by_emergency = tows.groupby('emergency')['emergency'].agg('count')
    emergencies = tows_by_emergency.index

    stmt = db.session.query(Parking).statement
    tickets = pd.read_sql_query(stmt, db.session.bind)
    tickets_by_emergency = tickets.groupby('emergency')['emergency'].agg('count')


    # print(snow_df)
    snow_amounts = []

    for emergency in emergencies:
        start_date = emergency_df[emergency_df['emergency'] == emergency].storm_begin_date.tolist()[0]
        print("start_date", start_date, "is of type: ", type(start_date))

        end_date  = emergency_df[emergency_df['emergency'] == emergency].declaration_date.tolist()[0]
    
        start_date = parse(start_date)
        print("start_date", start_date, "is of type: ", type(start_date))

        end_date = parse(end_date)
    
        snow_amounts.append(msp_snowtotals_by_dates(snow_df, start_date, end_date))
    
    data = {
        "emergency": emergencies.tolist(),
        "snowfall": snow_amounts,
        "tows": tows_by_emergency.tolist(),
        "tickets": tickets_by_emergency.tolist(),
    }
    print(data)
    return jsonify(data)

@app.route("/snowfall_by_event/<name>")
def snowfall_by_event(name):
    stmt = db.session.query(Episode).statement
    df = pd.read_sql_query(stmt, db.session.bind)
    # print(df)

    emergency_df = df[ df['emergency'] == name ]
    
    # print(emergency_df)

    stmt = db.session.query(Bsnowfall).statement
    snow_df = pd.read_sql_query(stmt, db.session.bind)

    # print(snow_df)

    start_date = emergency_df.storm_begin_date.tolist()[0]
    print("start_date", start_date, "is of type: ", type(start_date))

    end_date  = emergency_df.declaration_date.tolist()[0]
    
    start_date = parse(start_date)
    print("start_date", start_date, "is of type: ", type(start_date))

    end_date = parse(end_date)
    
    snow_amounts_df = metro_snowtotals_by_dates(snow_df, start_date, end_date)

    data = {
        "longitude": snow_amounts_df.longitude.tolist(),
        "latitude": snow_amounts_df.latitude.tolist(),
        "station": snow_amounts_df.station.tolist(),
        "name": snow_amounts_df.name.tolist(),
        "snowfall": snow_amounts_df.snowtotal.tolist()
    }
    return jsonify(data)

@app.route("/snowgeojson/<name>")
def snowgeojson(name):
    stmt = db.session.query(Episode).statement
    df = pd.read_sql_query(stmt, db.session.bind)
    # print(df)

    emergency_df = df[ df['emergency'] == name ]
    
    # print(emergency_df)

    stmt = db.session.query(Bsnowfall).statement
    snow_df = pd.read_sql_query(stmt, db.session.bind)

    # print(snow_df)

    start_date = emergency_df.storm_begin_date.tolist()[0]
    print("start_date", start_date, "is of type: ", type(start_date))

    end_date  = emergency_df.declaration_date.tolist()[0]
    
    start_date = parse(start_date)
    print("start_date", start_date, "is of type: ", type(start_date))

    end_date = parse(end_date)
    
    snow_amounts_df = metro_snowtotals_by_dates(snow_df, start_date, end_date)

    # print(snow_amounts_df)

    return df_to_geojson(snow_amounts_df, ['station', 'name', 'snowtotal'])

"""
App routes for returning the pre-scraped information.  These could be replaced 
by functions that scrape each time...
"""
@app.route("/episode/<name>")
def episode(name):
    stmt = db.session.query(Episode).statement
    df = pd.read_sql_query(stmt, db.session.bind)

    print(name)
    # Filter the data based on the sample number and
    # only keep rows with values above 1
    episode_data = df.loc[df['emergency']==name, ['narrative']]

    # Sort by sample
    #sample_data.sort_values(by=sample, ascending=False, inplace=True)

    # Format the data to send as json
    data = {
        "narrative": episode_data.narrative.tolist()
    }

    # print(data)
    return jsonify(data)

@app.route("/episode_satellite/<name>")
def episode_satellite(name):
    stmt = db.session.query(Episode).statement
    df = pd.read_sql_query(stmt, db.session.bind)

    # print("In episode_satellite")
    # Filter the data based on the sample number and
    # only keep rows with values above 1
    episode_data = df.loc[df['emergency']==name, ['gif_url']]

    # Sort by sample
    #sample_data.sort_values(by=sample, ascending=False, inplace=True)

    # Format the data to send as json
    data = {
        "gif_url": episode_data.gif_url.tolist()
    }

    # print(data)(),
    return jsonify(data)

"""
App routes for community summaries:
"""
@app.route("/towing_summary/<what>")
def towing_summary(what):

    if what == 'tows':
        stmt = db.session.query(Towing).statement
    else:
        stmt = db.session.query(Parking).statement

    events = pd.read_sql_query(stmt, db.session.bind)
    # The following are some post ETL data cleaning that 
    # will get removed when the database is rebuilt
    if what == 'tows':
        events.drop(8496, inplace=True)
    community = events.community
    community.replace({'Calhoun Isle' : 'Calhoun-Isles', 'Calhoun Isles': 'Calhoun-Isles', 'Near-North': 'Near North'}, inplace=True)
    events.community = community

    crosstable = pd.crosstab(events.community, events.emergency)

    data = {
        "emergency" : crosstable.columns.tolist(),
        "community" : crosstable.index.tolist(),
        "armatage" : crosstable.loc[:,'Armatage'].tolist(),
        "dana": crosstable.loc[:,'Dana'].tolist(),
        "diamondlake" : crosstable.loc[:,'Diamond Lake'].tolist(),
        "ferry": crosstable.loc[:,'Ferry'].tolist(),
        "grant": crosstable.loc[:,'Grant'].tolist(),
        "howe": crosstable.loc[:,'Howe'].tolist(),
        "jane" : crosstable.loc[:,'Jane'].tolist(),
        "olive": crosstable.loc[:,'Olive'].tolist(),
        "pembina" : crosstable.loc[:,'Pembina'].tolist(),
        "polk": crosstable.loc[:,'Polk'].tolist(),
        "quincy": crosstable.loc[:,'Quincy'].tolist(),
        "upton" : crosstable.loc[:,'Upton'].tolist(),
        "westminster": crosstable.loc[:,'Westminster'].tolist(),
        "xerxes" : crosstable.loc[:,'Xerxes'].tolist(),
        "yale": crosstable.loc[:,'Yale'].tolist(),
        "yardville" : crosstable.loc[:,'Yardville'].tolist(),
    }

    return jsonify(data)

@app.route("/stackedbar_tows/<what>")
def stackedbar_tows(what):

    if what == 'tows':
        stmt = db.session.query(Towing).statement
    else:
        stmt = db.session.query(Parking).statement

    events = pd.read_sql_query(stmt, db.session.bind)
    # The following are some post ETL data cleaning that 
    # will get removed when the database is rebuilt
    if what == 'tows':
        events.drop(8496, inplace=True)
    community = events.community
    community.replace({'Calhoun Isle' : 'Calhoun-Isles', 'Calhoun Isles': 'Calhoun-Isles', 'Near-North': 'Near North'}, inplace=True)
    events.community = community

    crosstable = pd.crosstab(events.community, events.emergency)

    data = {
        "emergency" : crosstable.columns.tolist(),
        "community" : crosstable.index.tolist(),
        "calhounisles" : crosstable.loc['Calhoun-Isles',:].tolist(),
        "camden": crosstable.loc['Camden',:].tolist(),
        "central" : crosstable.loc['Central',:].tolist(),
        "longfellow": crosstable.loc['Longfellow',:].tolist(),
        "nearnorth": crosstable.loc['Near North',:].tolist(),
        "nokomis" : crosstable.loc['Nokomis',:].tolist(),
        "northeast": crosstable.loc['Northeast',:].tolist(),
        "phillips" : crosstable.loc['Phillips',:].tolist(),
        "powderhorn": crosstable.loc['Powderhorn',:].tolist(),
        "southwest" : crosstable.loc['Southwest',:].tolist(),
        "university": crosstable.loc['University',:].tolist(),
     }

    return jsonify(data)

import statsmodels.api as sm
@app.route("/biplot/<what>")
def biplot(what):
    if what == 'tows':
        stmt = db.session.query(Towing).statement
    else:
        stmt = db.session.query(Parking).statement

    events = pd.read_sql_query(stmt, db.session.bind)
   
    # The following are some post ETL data cleaning that 
    # will get removed when the database is rebuilt
    if what == 'tows':
        events.drop(8496, inplace=True)
    community = events.community
    community.replace({'Calhoun Isle' : 'Calhoun-Isles', 'Calhoun Isles': 'Calhoun-Isles', 'Near-North': 'Near North'}, inplace=True)
    events.community = community

    crosstable = pd.crosstab(events.community, events.emergency)
    sample_crosstable = sm.stats.Table(pd.crosstab(events.community, events.emergency).values)

    # Produce the SVD of the matrix of residuals
    u,s,vh = np.linalg.svd(sample_crosstable.resid_pearson, full_matrices=False)
    row_scores = np.dot(u, np.diag(np.sqrt(s)))
    col_scores = np.dot(vh.T, np.diag(np.sqrt(s)))
    rows_df = pd.DataFrame(data=[l[0:2] for l in row_scores], columns=['R1', 'R2'])
    rows_df['community'] = crosstable.index
    cols_df = pd.DataFrame(data = [l[0:2] for l in col_scores], columns=['C1', 'C2'])
    cols_df['emergency'] =  crosstable.columns

    data = {
        "R1": rows_df.R1.tolist(),
        "R2": rows_df.R2.tolist(),
        "community": rows_df.community.tolist(),
        "C1": cols_df.C1.tolist(),
        "C2": cols_df.C2.tolist(),
        "emergency": cols_df.emergency.tolist()
    }
    return jsonify(data)

"""
App route for stacked bar plots for days
"""
@app.route("/stackedbar_days/<what>")
def stackedbar_days(what):

    print("I'm in this fucking app right now")

    if what == 'tows':
        stmt = db.session.query(Towing).statement
    else:
        stmt = db.session.query(Parking).statement

    events = pd.read_sql_query(stmt, db.session.bind)
    # The following are some post ETL data cleaning that 
    # will get removed when the database is rebuilt
    if what == 'tows':
        events.drop(8496, inplace=True)
    community = events.community
    community.replace({'Calhoun Isle' : 'Calhoun-Isles', 'Calhoun Isles': 'Calhoun-Isles', 'Near-North': 'Near North'}, inplace=True)
    events.community = community

    crosstable = pd.crosstab(events.day, events.emergency)

    print(crosstable)
    print("Where the fuck is this going wrong?")

    data = {
        "emergency" : crosstable.columns.tolist(),
        "day" : crosstable.index.tolist(),
        "day1" : crosstable.loc[1,:].tolist(),
        "day2" : crosstable.loc[2,:].tolist(),
        "day3" : crosstable.loc[3,:].tolist()
     }



    return jsonify(data)

"""
App routes to routine towing data
"""
@app.route("/towing/<name>")
def towing(name):
    stmt_tow = db.session.query(Towing).statement
    towing_df = pd.read_sql_query(stmt_tow, db.session.bind)

    # remove this once database rebuilt with additional cleaning
    towing_df.drop(8496, inplace=True) # remove odd longitude in Pembina emergency
    
    towing_data = towing_df.loc[towing_df['emergency']==name, ['longitude', 'latitude', 'day']]

    data = {
        "longitude" : towing_data.longitude.tolist(),
        "latitude" : towing_data.latitude.tolist(),
        "day": towing_data.day.tolist()
     }

    return jsonify(data)

@app.route("/daily_summary/<name>")
def daily_summary(name):
    stmt_tow = db.session.query(Towing).statement
    towing_df = pd.read_sql_query(stmt_tow, db.session.bind)

    # remove this once database rebuilt with additional cleaning
    towing_df.drop(8496, inplace=True) # remove odd longitude in Pembina emergency

    tow_df = towing_df.loc[towing_df['emergency']==name]
    
    weekday_dict = {0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday', 5: 'Saturday', 6: 'Sunday'}
    
    tow_df['weekday'] = tow_df['date'].apply(parse).apply(datetime.datetime.weekday).map(weekday_dict)

    stmt_tickets = db.session.query(Parking).statement
    parking_df = pd.read_sql_query(stmt_tickets, db.session.bind)
    tickets_df = parking_df.loc[parking_df['emergency']==name]
    
    tickets_df['weekday'] = tickets_df['date'].apply(parse).apply(datetime.datetime.weekday).map(weekday_dict)


    #tow_by_community = group_and_summarize_dataframe(tow_df, ['community'], [('tows', 'community', 'count')])
    tow_by_day = group_and_summarize_dataframe(tow_df, ['day'], [('tows', 'day', 'count')])
    tow_by_weekday = group_and_summarize_dataframe(tow_df, ['weekday'], [('tows', 'day', 'count')])
    tickets_by_day = group_and_summarize_dataframe(tickets_df, ['day'], [('tickets', 'weekday', 'count')])
    tickets_by_weekday = group_and_summarize_dataframe(tickets_df, ['weekday'], [('tickets', 'weekday', 'count')])
    

    data = {
        "day": tow_by_day.day.tolist(),
        "towsd": tow_by_day.tows.tolist(),
        "ticketsd": tickets_by_day.tickets.tolist(),
        "weekday": tow_by_weekday.weekday.tolist(),
        "towsw": tow_by_weekday.tows.tolist(),
        "ticketsw": tickets_by_weekday.tickets.tolist()
     }

    return jsonify(data)

"""
App route to return a list of snow emergency names
"""
@app.route("/names")
def names():
    stmt = db.session.query(Episode).statement
    stmt_df = pd.read_sql_query(stmt, db.session.bind)

    # Drop three rows - 'Howe2', 'Polk', 'Grant'
    # I do not have snowfall for them

    stmt_data = stmt_df[(stmt_df['emergency'] != 'Howe2') & (stmt_df['emergency'] != 'Grant')]
    data = {
        "name": stmt_data.emergency.tolist()
    }
    print(data)
    return jsonify(data)


@app.route("/emergency_summary/<name>")
def emergency_summary(name):
    stmt_tow = db.session.query(Towing).statement
    towing_df = pd.read_sql_query(stmt_tow, db.session.bind)
    towing_data = towing_df.loc[towing_df['emergency']==name, ['emergency', 'date']]

    #print("Check 1")

    stmt_parking = db.session.query(Parking).statement
    parking_df = pd.read_sql_query(stmt_parking, db.session.bind)
    parking_data = parking_df.loc[parking_df['emergency']==name,['emergency', 'date']]

    #print("Check 2")

    stmt_snowfall = db.session.query(Snowfall).statement
    snowfall_df = pd.read_sql_query(stmt_snowfall, db.session.bind)
    snowfall_data = snowfall_df.loc[snowfall_df['emergency']==name,['emergency', 'date']]

    #print("Check 3")

    data = {
        "towing_emergency" : towing_data.emergency.tolist(),
        "towing_date" : towing_data.date.tolist(),
        "parking_emergency" : parking_data.emergency.tolist(),
        "parking_date" : parking_data.date.tolist(),
        "snowfall_emergency" : snowfall_data.emergency.tolist(),
        "snowfall_date" : snowfall_data.date.tolist()    
    }

    return jsonify(data)


@app.route("/emergency_summaries")
def emergency_summaries():

    # Get total number of tows per emergency

    stmt_tow = db.session.query(Towing).statement
    towing_df = pd.read_sql_query(stmt_tow, db.session.bind)

    towcounts = towing_df.groupby(['emergency'])['emergency'].agg('count')
    
    # Get total number of tickets

    stmt_parking = db.session.query(Parking).statement
    parking_df = pd.read_sql_query(stmt_parking, db.session.bind)

    parkingcounts = parking_df.groupby(['emergency'])['emergency'].agg('count')
    
    # Get average snowfall amounts for each emergency

    stmt_snowfall = db.session.query(Snowfall).statement
    snowfall_df = pd.read_sql_query(stmt_snowfall, db.session.bind)
    snowfallaverage = snowfall_df.groupby(['emergency'])['Snowfall'].agg('mean')


    print("Check 3")

    data = {
        "emergency" : towcounts.index.tolist(),
        "tows" : towcounts.tolist(),
        "parking" : parkingcounts.tolist(),
        "snowfall" : snowfallaverage.tolist()
    }

    return jsonify(data)

if __name__ == "__main__":
    app.run()
