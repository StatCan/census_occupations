#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import csv
import json
import bson
import msgpack
import struct
import random

import codecs

import os.path

import docopt

import configparser

config_file = 'converter.ini'
if os.path.isfile(config_file):
    ini_config = configparser.ConfigParser()
    ini_config.read(config_file)

    # Sources
    base_path      = ini_config.get('source','base_path')
    mapping_reader = csv.reader(open(ini_config.get('source','mapping_reader'), 'rU'))
    data_reader    = csv.reader(open(ini_config.get('source','data_reader'), 'rU'))

    src_sgc_en_f   = ini_config.get('source','src_sgc_en')
    src_sgc_en     = json.loads(codecs.open(src_sgc_en_f,'r','utf-8').read())
    src_sgc_fr_f   = ini_config.get('source','src_sgc_fr')
    src_sgc_fr     = json.loads(codecs.open(src_sgc_fr_f,'r','utf-8').read())

bigly = False

mapping_data     = {}
data_data        = {}
mapping_highest_deg_data = {
    '1': {'en': 'Total – Highest certificate, diploma or degree', 'fr': 'Total – Plus haut certificat, diplôme ou grade'},
    '2': {'en': 'No certificate, diploma or degree', 'fr': 'Aucun certificat, diplôme ou grade'},
    '3': {'en': 'Secondary (high) school diploma or equivalency certificate', 'fr': "Diplôme d'études secondaires ou attestation d'équivalence"},
    '4': {'en': 'Apprenticeship or trades certificate or diploma', 'fr': "Certificat ou diplôme d'apprenti ou d'une école de métiers"},
    '5': {'en': 'College, CEGEP or other non-university certificate or diploma', 'fr': "Certificat ou diplôme d'un collège, d'un cégep ou d'un autre établissement non universitaire"},
    '6': {'en': 'University certificate or diploma below bachelor level', 'fr': 'Certificat ou diplôme universitaire inférieur au baccalauréat'},
    '7': {'en': 'University certificate, diploma or degree at bachelor level or above', 'fr': 'Certificat, diplôme ou grade universitaire au niveau du baccalauréat ou supérieur'},
}
mapping_vars_data = {
#    'count_elf':      {'en': 'Employed labour force aged 25 to 54 years who worked at least one week in 2015', 'fr': "Personnes occupées âgées de 25 à 54 ans ayant travaillé au moins une semaine en 2015"},
    'count_elf_fyft': {'en': 'Employed labour force aged 25 to 54 years who worked full year full time and reported employment income in 2015', 'fr': "Personnes occupées âgées de 25 à 54 ans ayant travaillé toute l’année à temps plein et ayant déclaré un revenue d’emploi en 2015"},
    'med_earnings':   {'en': 'Median employment income in 2015 ($)', 'fr': "Revenu d'emploi médian en 2015 ($)"}
}
mapping_province_codes = {
    "01": "CA",
    "10": "NL",
    "11": "PE",
    "12": "NS",
    "13": "NB",
    "24": "QC",
    "35": "ON",
    "46": "MB",
    "47": "SK",
    "48": "AB",
    "59": "BC",
    "60": "YK",
    "61": "NT",
    "62": "NU"
}

next_id          = 0
sequential_ids   = {}
sequential_ids_r = {}

output_data      = {}
output_data_gar  = {}

order_geos = []
order_noc  = []
seen_geos = {}
seen_noc  = {}

rownum = 0
for row in mapping_reader:
    if rownum < 1:
        rownum += 1
        continue
    #elif rownum > 5:
    #    continue
    else:
        # Exclude ERR
        if row[0] == '':
            continue
        # Exclude Canada
        if row[0] == '0.1':
            continue

        if row[3] not in sequential_ids:
            sequential_ids[row[3]] = next_id
            sequential_ids_r[next_id] = row[3]

        row_data = {}
        #row_data['id']     = next_id
        row_data['sort']     = int(row[0].strip())
        row_data['level']    = int(row[1].strip())
        row_data['occ_num']  = row[2].strip()
        row_data['occ_code'] = row[3].strip()
        row_data['en']       = row[4].strip()
        row_data['fr']       = row[5].strip()

        # Cheap but it works, capture a key for everything known
        if row_data['occ_code'] not in seen_noc:
            order_noc.append(row_data['occ_code'])
            seen_noc[row_data['occ_code']] = 1

        #print row_data
        mapping_data[next_id] = row_data

        next_id += 1
        rownum += 1

#print "MAPPING_DATA"
#print mapping_data

rownum = 0
for row in data_reader:
    if rownum < 1:
        rownum += 1
        continue
    else:
        rownum += 1
        if row[3].strip() == '':
            continue
        # Exclude Canada
        if row[3] == '0.1':
            continue

        if row[3] not in sequential_ids:
            print("ERR: Missing id for data row ["+str(rownum)+"] ["+row[0]+" "+row[1]+"] "+row[3])
            continue

        row_data = {}
        row_data['id']       = sequential_ids[row[3]]
        row_data['geocode']  = row[0]

        row_data['hcdd']           = int(row[1].strip())
        row_data['occ_num']        = row[2].strip()
        row_data['occ_code']       = row[3].strip()
        row_data['count_elf_fyft'] = int(row[4].strip())
        row_data['med_earnings']   = int(row[5].strip())

        # Cheap but it works, capture a key for everything known
        if row_data['geocode'] not in seen_geos:
            order_geos.append(row_data['geocode'])
            seen_geos[row_data['geocode']] = 1

        ## Check on the split
        #
        # Files per period
        # data_data['period']['geo']['id'] = row_data
        #if row_data['period'] not in data_data:
        #    data_data[row_data['period']] = {}

        # Data level 1
        if row_data['geocode'] not in data_data:
            data_data[row_data['geocode']] = {}

        # Data level 2
        if row_data['hcdd'] not in data_data[row_data['geocode']]:
            data_data[row_data['geocode']][row_data['hcdd']] = {}

        # Data level 3
        if row_data['id'] not in data_data[row_data['geocode']][row_data['hcdd']]:
            data_data[row_data['geocode']][row_data['hcdd']][row_data['occ_code']] = {}

        data_data[row_data['geocode']][row_data['hcdd']][row_data['occ_code']] = row_data # Imbued with Data level 4

# Build the indicies
output_data['indexes'] = []
output_data['indexes'].append({'type':'sgc', 'data': []})
output_data['indexes'].append({'type':'hcdd', 'data': []})
output_data['indexes'].append({'type':'noc', 'data': []})
output_data['indexes'].append({'type':'property', 'data': []})
output_data['data'] = []

for geo in sorted(data_data):
    output_data['indexes'][0]['data'].append(geo)
for highest_deg in sorted(mapping_highest_deg_data):
    output_data['indexes'][1]['data'].append(int(highest_deg))
for noc in sorted(seen_noc):
    output_data['indexes'][2]['data'].append(noc)
for prop in sorted(mapping_vars_data):
    output_data['indexes'][3]['data'].append(prop)


# Count fractions for the UI
glt_1 = glt_p1 = glt_p01 = glt_p001 = glt_p0001 = 0
gnlt_1 = gnlt_p1 = gnlt_p01 = gnlt_p001 = gnlt_p0001 = 0
gbase_count = data_data['01'][1]['X']['count_elf_fyft']
gbase_count += data_data['01'][2]['X']['count_elf_fyft']
gbase_count += data_data['01'][3]['X']['count_elf_fyft']
gbase_count += data_data['01'][4]['X']['count_elf_fyft']
gbase_count += data_data['01'][5]['X']['count_elf_fyft']
gbase_count += data_data['01'][6]['X']['count_elf_fyft']
gbase_count += data_data['01'][7]['X']['count_elf_fyft']


for geo in sorted(data_data):
    geo_line = []

    # Count fractions for the UI
    lt_1 = lt_p1 = lt_p01 = lt_p001 = lt_p0001 = 0
    nlt_1 = nlt_p1 = nlt_p01 = nlt_p001 = nlt_p0001 = 0
    base_count = data_data[geo][1]['X']['count_elf_fyft']
    base_count += data_data[geo][2]['X']['count_elf_fyft']
    base_count += data_data[geo][3]['X']['count_elf_fyft']
    base_count += data_data[geo][4]['X']['count_elf_fyft']
    base_count += data_data[geo][5]['X']['count_elf_fyft']
    base_count += data_data[geo][6]['X']['count_elf_fyft']
    base_count += data_data[geo][7]['X']['count_elf_fyft']
    print(str(geo)+":"+str(base_count))
    
    for highest_deg in sorted(mapping_highest_deg_data):
        highest_deg_line = []
        for noc in sorted(seen_noc):

            if geo in data_data and int(highest_deg) in data_data[geo] and noc in data_data[geo][int(highest_deg)]:
                # Count fractions for the UI
                local_count_elf_fyft = data_data[geo][int(highest_deg)][noc]['count_elf_fyft']
                if local_count_elf_fyft > 0:
                    local_count_elf_fyft *= 100 # Pre-cook the precentage calculation
                    #print(str(local_count_elf_fyft)+" / "+str(base_count))
                    if local_count_elf_fyft / base_count < 1:
                        lt_1 += 1
                        glt_1 += 1
                    else:
                        nlt_1 += 1
                        gnlt_1 += 1
                    if local_count_elf_fyft / base_count < .1:
                        lt_p1 += 1
                        glt_p1 += 1
                    else:
                        nlt_p1 += 1
                        gnlt_p1 += 1
                    if local_count_elf_fyft / base_count < .01:
                        lt_p01 += 1
                        glt_p01 += 1
                    else:
                        nlt_p01 += 1
                        gnlt_p01 += 1
                    if local_count_elf_fyft / base_count < .001:
                        lt_p001 += 1
                        glt_p001 += 1
                    else:
                        nlt_p001 += 1
                        gnlt_p001 += 1
                    if local_count_elf_fyft / base_count < .0001:
                        lt_p0001 += 1
                        glt_p0001 += 1
                    else:
                        nlt_p0001 += 1
                        gnlt_p0001 += 1

            noc_line = []
            for prop in sorted(mapping_vars_data):
                prop_line = []
                if geo in data_data and int(highest_deg) in data_data[geo] and noc in data_data[geo][int(highest_deg)]:
                    output_data['data'].append(data_data[geo][int(highest_deg)][noc][prop])
                else:
                    output_data['data'].append(0)
                noc_line.append(prop_line)
            highest_deg_line.append(noc_line)
        geo_line.append(highest_deg_line)

    # Count fractions for the UI
    print("["+
            "<1 "+str(lt_1)+":"+str(nlt_1)+", "+
            "<.1 "+str(lt_p1)+":"+str(nlt_p1)+", "+
            "<.01 "+str(lt_p01)+":"+str(nlt_p01)+" "+
            "<.001 "+str(lt_p001)+":"+str(nlt_p001)+
            "<.0001 "+str(lt_p0001)+":"+str(nlt_p0001)+
        "]")

# Count fractions for the UI
print("Global")
print("["+
        "<1 "+str(glt_1)+":"+str(gnlt_1)+", "+
        "<.1 "+str(glt_p1)+":"+str(gnlt_p1)+", "+
        "<.01 "+str(glt_p01)+":"+str(gnlt_p01)+" "+
        "<.001 "+str(glt_p001)+":"+str(gnlt_p001)+
        "<.0001 "+str(glt_p0001)+":"+str(gnlt_p0001)+
    "]")

# Make both files
with open(base_path+'\census_occupation.un-mini.json', 'w') as outfile:
    outfile.write(json.dumps(output_data, sort_keys=True, indent=4, separators=(',', ': ')))
with open(base_path+'\census_occupation.mini.json', 'w') as outfile:
    outfile.write(json.dumps(output_data, separators=(',', ': ')))

output_data_gar = dict(output_data)
output_data_gar['data'] = []

for geo in sorted(data_data):
    geo_line = []
    for highest_deg in sorted(mapping_highest_deg_data):
        highest_deg_line = []
        for noc in sorted(seen_noc):
            noc_line = []
            for prop in sorted(mapping_vars_data):
                prop_line = []
                if geo in data_data and int(highest_deg) in data_data[geo] and noc in data_data[geo][int(highest_deg)]:
                    gar_val = data_data[geo][int(highest_deg)][noc][prop]
                    if(random.random() > 0.5):
                        gar_val += gar_val * (random.random()/5)
                    else:
                        gar_val -= gar_val * (random.random()/5)
                        if(gar_val < 1):
                            gar_val = 0
                    gar_val = int(gar_val)
                    output_data_gar['data'].append(gar_val)
                else:
                    output_data['data'].append(0)
                    output_data_gar['data'].append(0)
                noc_line.append(prop_line)
            highest_deg_line.append(noc_line)
        geo_line.append(highest_deg_line)

with open(base_path+'\census_occupation.un-mini.gar.json', 'w') as outfile:
    outfile.write(json.dumps(output_data_gar, sort_keys=True, indent=4, separators=(',', ': ')))
with open(base_path+'\census_occupation.mini.gar.json', 'w') as outfile:
    outfile.write(json.dumps(output_data_gar, separators=(',', ': ')))

geo_options_en = geo_options_fr = ''
noc_options_en = noc_options_fr = ''

for geo in order_geos:
    geo_options_en += "<option value='"+geo+"'>"+src_sgc_en['en']['sgc']['sgc_'+str(geo)]+"</option>"
    geo_options_fr += "<option value='"+geo+"'>"+src_sgc_fr['fr']['sgc']['sgc_'+str(geo)]+"</option>"

for noc in order_noc:
    noc_options_en += "<option value='"+noc+"'>"+mapping_data[sequential_ids[noc]]['en']+"</option>"
    noc_options_fr += "<option value='"+noc+"'>"+mapping_data[sequential_ids[noc]]['fr']+"</option>"

dropdown_text_en = """
                <div class="form-group col-md-12">
                    <label for="noc">NOC</label>
                    <select id="noc" class="form-control" aria-describedby="chgnot">
"""+noc_options_en+"""
                    </select>
                </div>
                <div class="col-md-4 form-group">
                    <label for="sgc">Geocode</label>
                    <select id="sgc" class="form-control" aria-describedby="chgnot">
"""+geo_options_en+"""
                    </select>
                </div>
                <div class="col-md-8 form-group">
                    <label for="hcdd">Highest certificate, diploma or degree</label>
                    <select id="hcdd" class="form-control" aria-describedby="chgnot">
                        <option value="1">Total – Highest certificate, diploma or degree</option>
                        <option value="2">No certificate, diploma or degree</option>
                        <option value="3">Secondary (high) school diploma or equivalency certificate</option>
                        <option value="4">Apprenticeship or trades certificate or diploma</option>
                        <option value="5">College, CEGEP or other non-university certificate or diploma</option>
                        <option value="6">University certificate or diploma below bachelor level</option>
                        <option value="7">University certificate, diploma or degree at bachelor level or above</option>
                    </select>
                </div>
                <!--
                <div class="form-group col-md-3">
                    <label for="immperiod">Period of immigration</label>
                    <select id="immperiod" class="form-control" aria-describedby="chgnot">
                        <option value="count_elf">Employed labour force aged 25 to 54 years who worked at least one week in 2015</option>
                        <option value="count_elf_fyft">Employed labour force aged 25 to 54 years who worked full year full time and reported employment income in 2015</option>
                        <option value="med_earnings">Median employment income in 2015 ($)</option>
                    </select>
                </div>
                -->
"""

dropdown_text_fr = """
                <div class="form-group col-md-12">
                    <label for="noc">NOC</label>
                    <select id="noc" class="form-control" aria-describedby="chgnot">
"""+noc_options_fr+"""
                    </select>
                </div>
                <div class="col-md-4 form-group">
                    <label for="sgc">Geocode</label>
                    <select id="sgc" class="form-control" aria-describedby="chgnot">
"""+geo_options_fr+"""
                    </select>
                </div>
                <div class="col-md-8 form-group">
                    <label for="hcdd">Highest certificate, diploma or degree</label>
                    <select id="hcdd" class="form-control" aria-describedby="chgnot">
                        <option value="1">Total – Plus haut certificat, diplôme ou grade
                        <option value="2">Aucun certificat, diplôme ou grade
                        <option value="3">Diplôme d'études secondaires ou attestation d'équivalence
                        <option value="4">Certificat ou diplôme d'apprenti ou d'une école de métiers
                        <option value="5">Certificat ou diplôme d'un collège, d'un cégep ou d'un autre établissement non universitaire
                        <option value="6">Certificat ou diplôme universitaire inférieur au baccalauréat
                        <option value="7">Certificat, diplôme ou grade universitaire au niveau du baccalauréat ou supérieur
                    </select>
                </div>
                <!-- 
                <div class="form-group col-md-3">
                    <label for="immperiod">Period of immigration</label>
                    <select id="immperiod" class="form-control" aria-describedby="chgnot">
                        <option value="count_elf">Personnes occupées âgées de 25 à 54 ans ayant travaillé au moins une semaine en 2015</option>
                        <option value="count_elf_fyft">Personnes occupées âgées de 25 à 54 ans ayant travaillé toute l’année à temps plein et ayant déclaré un revenue d’emploi en 2015</option>
                        <option value="med_earnings">Revenu d'emploi médian en 2015 ($)</option>
                    </select>
                </div>
                -->
"""

with codecs.open(base_path+'\dropdown-en.html', 'w', 'utf-8') as outfile:
    outfile.write(dropdown_text_en)
with open(base_path+'\dropdown-fr.html', 'w') as outfile:
    outfile.write(dropdown_text_fr)

