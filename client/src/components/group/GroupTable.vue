<template>
  <ag-grid-vue
    :localeText="aggridLocale.locale_de"
    :style="tableStyle"
    class="ag-theme-material"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :rowData="rowData"
    :isExternalFilterPresent="isExternalFilterPresent"
    :doesExternalFilterPass="doesExternalFilterPass"
    :suppressRowClickSelection="comboSelect"
    :row-selection="rowSelection"
    @grid-ready="onGridReady"
    @first-data-rendered="onFirstDataRendered"
    @row-selected="onRowSelected"
    @selection-changed="selected => $emit('selectionChanged', gridApi.getSelectedRows())"
    :pagination="true"
    paginationPageSize="25"
  />
</template>

<script>
import axios from 'axios'
import moment from 'moment'
import router from '../../router'
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";
import aggridLocale from '@/assets/ag-grid.locale.js';
import { AgGridVue } from "ag-grid-vue";
import ExpanderCell from '@/components/table/ExpanderCell';
import ChipCell from '@/components/table/ChipCell';
import SelectCell from '@/components/table/SelectCell';
export default {
  name: 'GroupTable',
  components: {
    AgGridVue, ExpanderCell, ChipCell, SelectCell
  },
  props: {
    groups: Array,
    search: String,
    flat: Boolean,
    showMembers: Boolean,
    selectCellItems: Array,
    comboSelect: Boolean,
    heightOffset: Number,
    rowSelection: String
  },
  data () {
    return {
      tableStyle: '',
      defaultColDef: [],
      columnDefs: [],
      rowData: [],
      collapsedNodes: [],
      aggridLocale: aggridLocale,
      gridApi: null,
      columnApi: null
    }
  },
  watch: {
    search(newSearch, oldSearch) {
      this.rowData.forEach(row => {
        if (newSearch != '') {
          row.filtered = !row.rowText.toLowerCase().includes(newSearch.toLowerCase());
        } else {
          row.filtered = false;
        }
      })
      // also show parents of found rows
      this.rowData.forEach(row => {
        if (!row.filtered && newSearch != '') {
          this.rowData.forEach(r => {
            if(row.hierarchy.path.startsWith(r.hierarchy.path)) {
              r.filtered = false
            }
          })
        }
      })
      this.gridApi.onFilterChanged();
    }
  },
  methods: {
    onGridReady(params) {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
        this.$emit('onGridReady', params);
    },
    isExternalFilterPresent() {
      return true;
    },
    doesExternalFilterPass(node) {
      var pass = true;
      var self = this;
      this.collapsedNodes.forEach(cn => {
        if (node.data.hierarchy.path.startsWith(cn)) {
          pass = false;
        }
      })
      return pass && !node.data.filtered;
    },
    onFirstDataRendered(params) {
      this.columnApi.autoSizeAllColumns()
      this.$emit('onDataRendered');
    },
    onRowSelected(event) {
      // also select / deselect rows with the same group
      if (event.node.data.selectCell) {
        this.gridApi.forEachNode((rowNode, index) => {
          if (rowNode.data.dn === event.node.data.dn && rowNode.data.selectCell.value !== event.node.data.selectCell.value) {
            rowNode.data.selectCell = event.node.data.selectCell
            rowNode.setData(rowNode.data);
          }
        });
      }
      if (this.comboSelect !== 'true') {
        this.$emit('selectGroup', event.node.data, event.node.isSelected())
      } else {
        this.$emit('selectGroup', event.node.data, event.node.data.selectCell)
      }
    },
    flattenTree(groups, parents, group) {
      var hierarchy = [].concat(parents);
      var flatGroup = {
        hierarchy: {parents: parents, text: group.o, children: group.subGroups},
        dn: group.dn,
        cn: group.cn,
        o: group.o,
        description: group.description,
        owner: group.owner,
        admins: group.owner.map(owner => { return {
          dn: owner,
          cn: owner.split(',')[0].split('=')[1]
        }}),
        member: group.member,
        subGroups: group.subGroups,
        rowText: group.cn + ' ' + group.o + ' ' + group.description,
        selectCell: {}
      };

      hierarchy.push(group.dn);
      flatGroup.hierarchy.path = hierarchy.join('|')
      groups.push(flatGroup)
      if (group.subGroups) {
        group.subGroups.forEach(subGroup => {
          this.flattenTree(groups, hierarchy, subGroup);
        })
      }
    },
    expandGroup(expand, value) {
      if (!expand) {
        if (!this.collapsedNodes.includes(value)) {
          this.collapsedNodes.push(value);
        }
      } else {
        if (this.collapsedNodes.includes(value)) {
          this.collapsedNodes.splice(this.collapsedNodes.indexOf(value), 1);
        }
      }
      this.gridApi.onFilterChanged()
    }
  },
  created() {
    this.tableStyle = "width: 100%; height: calc(100% - " + (this.heightOffset || 0) +"px)"
    this.groups.forEach(group => {
      this.flattenTree(this.rowData, [], group);
    })
    var selectorCellDef;
    if (this.comboSelect) {
      selectorCellDef = { headerName: "", field: "selectCell", maxWidth: 50, cellRenderer: 'SelectCell', cellRendererParams:
        { items: this.selectCellItems || []},
        autoHeight: false
      }
    } else {
      selectorCellDef = { checkboxSelection: true, maxWidth: 50};
    }
    var textStyle = { 'line-height': 'normal', 'padding-top': '14px', 'padding-bottom': '14px'}

    var groupCellDef;
    if (this.flat) {
      groupCellDef = {headerName: 'Anzeigename', field: 'o', cellStyle: textStyle}
    } else {
      groupCellDef = { headerName: "Anzeigename", field: "hierarchy", cellStyle: textStyle, cellRenderer: 'ExpanderCell', cellRendererParams: { collapsedNodes: this.collapsedNodes, callback: this.expandGroup }
      }
    }

    this.columnDefs = [
      selectorCellDef,
      groupCellDef,
      { headerName: "ID", field: "cn", cellStyle: textStyle},
      { headerName: "Beschreibung", field: "description", cellStyle: textStyle}
    ];
    if (this.showMembers) {
      this.columnDefs.push({ headerName: 'Mitglieder', valueGetter: (params) => { return params.data.member.length - params.data.subGroups.length }})
      this.columnDefs.push({ headerName: "Admin@s", field: "admins", cellStyle: {'white-space': 'normal'}, maxWidth: 300, autoHeight: true,cellRenderer: 'ChipCell', cellRendererParams: { color: 'info', tooltip: 'user', field: 'cn' }
        })

    }
    this.defaultColDef = {
      resizable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { 'word-break': 'normal'}
    };
  },
}
</script>
