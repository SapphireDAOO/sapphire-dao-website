/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DataTable = <TData,>({
  columns,
  data,
  statuses,
  currentTab,
}: {
  columns: any[];
  data: TData[];
  statuses: { label: string; value: string }[];
  currentTab?: string; // "seller" or "buyer"
}) => {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredColumns = useMemo(() => {
    return columns.filter((column) => {
      // Hide "Release" column when on "buyer" tab
      // if (currentTab === "buyer" && column.accessorKey === "releaseHash") {
      //   return false;
      // }
      // Show "seller" column only when on "buyer" tab
      if (currentTab !== "buyer" && column.accessorKey === "seller") {
        return false;
      }

      if (currentTab === "buyer" && column.accessorKey === "buyer") {
        return false;
      }
      return true;
    });
  }, [columns, currentTab]);

  const filteredData = useMemo(() => {
    return data.filter((row: any) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        row.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchesSearch =
        searchQuery.trim() === "" ||
        row.id?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [data, statusFilter, searchQuery]);

  const newData = useMemo(() => {
    const allData = filteredData
      .filter((i: any) => i.status === "PAID")
      .reverse();

    const otherData = filteredData.filter((i: any) => i.status !== "PAID");

    return [...allData, ...otherData];
  }, [filteredData]);

  const table = useReactTable({
    data: newData,
    columns: filteredColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center justify-between py-4">
        <Input
          placeholder="Search by ID..."
          className="max-w-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-md w-52"
        >
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell ?? "",
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={filteredColumns.length}
                  className="text-center"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default DataTable;
