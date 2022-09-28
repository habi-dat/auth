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
    @grid-ready="onGridReady"
    @first-data-rendered="onFirstDataRendered"
    @row-selected="onRowSelected"
    @selection-changed="selected => $emit('selectionChanged', gridApi.getSelectedRows())"
    :pagination="true"
    paginationPageSize="25"
    row-selection="single"
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
import ColorCell from '@/components/table/ColorCell';
export default {
  name: 'CategoryTable',
  components: {
    AgGridVue, ExpanderCell, ChipCell, ColorCell
  },
  props: {
    categories: Array,
    search: String,
    heightOffset: Number
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
          row.filtered = !row.name.toLowerCase().includes(newSearch.toLowerCase());
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
    },
    onRowSelected(event) {
      this.$emit('selectCategory', event.node.data, event.node.isSelected());
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
    this.rowData = this.categories.map(category => {
      var row = {...category}
      var parents = (category.parent === -1)?[]:[category.parent];
      row.hierarchy = {
        parents: parents,
        children: category.children,
        text: category.name,
        path: parents.concat([category.id]).join('|')
      }
      return row;
    });
    var selectorCellDef;
    selectorCellDef = { checkboxSelection: true, maxWidth: 50};
    var textStyle = { 'line-height': 'normal', 'padding-top': '14px', 'padding-bottom': '14px'}

    var groupCellDef;
    groupCellDef = {
      headerName: "Name",
      field: "hierarchy",
      cellRenderer: 'ExpanderCell',
      cellRendererParams: { collapsedNodes: this.collapsedNodes, callback: this.expandGroup }
    }

    this.columnDefs = [
      selectorCellDef,
      groupCellDef,
      { headerName: "URL", field: "slug", cellStyle: textStyle},
      { headerName: "Hintergrundfarbe", field: "color",  cellRenderer: 'ColorCell'},
      { headerName: "Vordergrundfarbe", field: "text_color",  cellRenderer: 'ColorCell'},
      { headerName: "Themen", field: "topic_count", cellStyle: textStyle},
      { headerName: "Posts", field: "post_count", cellStyle: textStyle}
    ];
    this.columnDefs.push({ headerName: "Gruppen", field: "groups", cellStyle: {'white-space': 'normal'}, maxWidth: 300, autoHeight: true, cellRenderer: 'ChipCell', cellRendererParams: { color: 'info' }
      })
    this.defaultColDef = {
      resizable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { 'word-break': 'normal'}
    };
  },
}
</script>
